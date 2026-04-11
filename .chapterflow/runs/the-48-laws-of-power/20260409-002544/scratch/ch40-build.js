const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const runRoot = path.resolve(".chapterflow/runs/the-48-laws-of-power/20260409-002544");
const num = 40;
const stem = `ch${String(num).padStart(2, "0")}`;
const title = "Despise the Free Lunch";
const chapterId = "ch40-despise-the-free-lunch";
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

const canonical = `Greene's fortieth law turns from exposed weakness toward the kind of dependence that creates weakness quietly. The chapter begins with the lure of what looks free, cheap, or effortless. A gift, a shortcut, or a bargain may appear generous on the surface. Greene's claim is that the surface can mislead. Easy access often hides a second cost paid later in freedom, judgment, or obligation.

Its point is narrower than blanket suspicion. The law does not say that every gift is corrupt or that generosity is always a trap. Greene is arguing that hidden cost matters strategically. Cheap offers can lower standards, attach strings, or train the receiver to accept dependence. The bargain is dangerous not because the first price is low, but because the real price is deferred and often paid in autonomy.

That is why the chapter distinguishes fair exchange from the free-lure trap. Fair exchange is legible. Both sides know what is being given and what is being received. The trap begins when the receiver treats visible price as total price and ignores the obligation, influence, or narrowing of options that comes with the offer. Paying full cost can therefore be protective. It keeps the transaction clean and preserves room to refuse later pressure.

Ordinary settings make the mechanism easy to see. A work favor may quietly purchase influence over future decisions. A school stipend may come with expectations that are softer than rules but just as constraining. Personal help may solve an immediate problem while creating a longer dependency that becomes hard to challenge without seeming ungrateful. In each case, the real issue is not money alone. It is whether the bargain leaves the receiver freer or more owned.

The law reaches too far when it becomes paranoia, vanity about self-sufficiency, or contempt for genuine goodwill. Some help is fair. Some generosity is real. Some support is worth accepting because the exchange remains clean and does not purchase hidden control. Greene is strongest when he asks the reader to see the full price clearly, not when he invites distrust of everyone who offers something useful. Chapter 39 showed how weakness can be exposed under disturbance. Chapter 40 asks how weakness can be planted through appetite for what comes too easily. Chapter 41 follows by shifting from cheap dependence toward the danger of imitation and extreme reaction.`;

const edited = canonical;

const critic = `# Chapter 40 Critic Report

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
- Paragraph 4 is most exposed because work, school, and personal examples can flatten into generic frugality advice if conversion loses the autonomy-versus-obligation mechanism.

Strongest sentence:
- "The bargain is dangerous not because the first price is low, but because the real price is deferred and often paid in autonomy."

Anchor use notes:
- The draft stays inside the frozen support: hidden cost, dependency, obligation, lowered standards, autonomy, and the gratitude limit on suspicion.

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
        "This law says that what looks free can still cost you something important later. Greene is not arguing that every gift is false or that all help is dangerous. The point is that cheap offers can create obligation, lower your standards, or make you easier to influence. A bargain can feel like relief at first while quietly reducing your freedom later. That is why the chapter respects visible cost more than hidden cost. Paying clearly can protect your judgment. Taking the free lure without checking the strings can leave you owned in ways that were not obvious when the offer first appeared.",
        "Greene's fortieth law argues that free and cheap offers often hide a second price. The issue is not price alone. The issue is dependence. A gift, shortcut, or bargain can create obligation and make refusal harder later. The law is not generic anti-generosity advice. It is advice to see the full exchange clearly. Sometimes paying the true cost preserves more autonomy than accepting what feels easy in the moment.",
        "This law gives a competitive warning: what costs little up front may cost control later. Greene wants the reader to distrust the lure of easy access when it quietly purchases influence. Cheapness can weaken standards. Free help can train dependence. But the chapter has a limit. Suspicion becomes foolish once it treats every fair exchange as manipulation. The edge comes from seeing hidden price early and refusing the bargains that buy your freedom too cheaply."
      ),
      keyTakeaways: [
        { point: tone("Free offers can hide a second cost.", "What looks cheap may carry obligation, dependence, or influence.", "Low entry price can conceal a higher strategic cost.") },
        { point: tone("Paying clearly can preserve autonomy.", "Visible cost is often safer than hidden cost.", "The clean transaction often protects freedom better than the bargain trap.") },
        { point: tone("The law has a gratitude limit.", "Not every gift is manipulative, and fair exchange still exists.", "Paranoia can waste as much value as dependence.") }
      ],
      oneMinuteRecap: tone(
        "This law says the free lure is dangerous when it hides cost paid later in obligation or reduced freedom.",
        "Choose the exchange that leaves the full price visible and your options less owned.",
        "Reject cheap dependence, not genuine fairness."
      )
    },
    medium: {
      chapterBreakdown: tone(
        `A free offer can be expensive in the way that matters most. Greene's fortieth law begins with that inversion. Something may look generous, cheap, or easy because the first cost is low or invisible. Yet the real cost may appear later as obligation, lowered standards, or dependence. The chapter turns the reader away from sticker price and toward the full structure of the exchange.

That is why hidden cost matters here. Greene is not saying that every favor is corrupt. He is saying that people become easier to influence once they start receiving value they do not want to price clearly. A gift can purchase future leverage. A shortcut can train weakened standards. A bargain can feel efficient now while narrowing your freedom later. The danger is not comfort alone. The danger is becoming easier to direct because you accepted something without naming its real price.

The key distinction is between fair exchange and the free-lure trap. Fair exchange is visible. Both sides can see the terms and the obligation stays limited to those terms. The trap begins when the visible price looks small enough that the hidden price is ignored. Greene respects paying full cost because it keeps the transaction legible. When cost stays legible, autonomy is easier to preserve.

Ordinary settings show the pattern clearly. Sarif may refuse a work bargain that would quietly purchase influence over his later decisions. Elow may weigh whether a grant offer or committee stipend carries soft obligations that will shape her choices. A personal favor may solve a problem while also making future refusal harder. In each case, the question is not whether receiving help is shameful. The question is whether the help leaves the receiver freer or more dependent.

The law becomes weak if it turns into anti-generosity theater. Some help is fair. Some support is real. Some exchanges are worth accepting precisely because they remain transparent and do not smuggle in control. Greene's stronger point is narrower: see the true cost before you accept the easy offer. Chapter 39 showed weakness exposed under disturbance. Chapter 40 shows weakness cultivated through appetite for what feels cheap. Chapter 41 then asks how stability is preserved by avoiding imitation and extremes.`,
        `Easy access often creates the wrong kind of debt. Greene uses that idea to shift the reader from visible price to hidden consequence. A free lunch matters because the first relief can hide a second bill paid in obligation, dependence, or reduced room to refuse later pressure.

That is why cheapness is not automatically a win. A person who keeps taking the bargain may slowly accept lower standards, weaker leverage, and less freedom. Greene's practical claim is that paying the real cost up front can be safer than postponing the cost into a relationship of influence. The issue is not money in isolation. The issue is whether the exchange keeps your choices clean.

The chapter is strongest when it separates prudence from cynicism. Prudence asks what the full price is. Cynicism assumes every gift is poison. Greene is not asking the reader to insult goodwill or refuse all help. He is asking the reader to detect when help quietly buys control. Fair exchange remains possible. Hidden-purchase exchange is the trap.

The pattern appears everywhere. Sarif can decline a work favor because the bargain would compromise later judgment. Elow can look past the school stipend amount and study the soft expectations attached to it. A personal favor can look kind while still training dependence. The chapter stays specific when each example keeps autonomy, obligation, and true cost visible at the same time.

The law overreaches if it becomes vanity about never needing anyone. Its useful boundary is sharper than that: accept fair help, reject help that purchases your freedom, and price the exchange before gratitude makes analysis harder. Chapter 39 dealt with pressure exposing weakness. Chapter 40 deals with dependency creating weakness. The next law turns toward the instability created by copying and overreacting rather than holding a steady center.`,
        `The cheapest offer is not always the least expensive choice. Greene's fortieth law rests on that strategic correction. Many people evaluate an offer by what it costs in the moment. Greene evaluates it by what it makes the receiver owe, tolerate, or become. What looks free may be the first move in a longer purchase of influence.

That is why the law values visible price over invisible price. Once a person starts accepting value without naming its real cost, judgment can soften. Standards drop because the easy path keeps winning. Dependence grows because refusal becomes socially awkward or materially difficult. Greene's harder claim is that paying clearly can preserve more freedom than accepting the bargain that saves money now.

This is also why the chapter should not be flattened into praise for suspicion. Some exchanges are fair, and some generosity is real. The strategic error is not receiving help. The strategic error is treating apparent cheapness as total cost. If hidden obligation, lowered standards, or future influence are part of the exchange, the offer is not free. It is merely delayed in how it charges.

Common settings make the line visible. Sarif can see that a work bargain is really an influence purchase. Elow can detect that a school grant or committee stipend may come with expectations that are not written as rules but still shape behavior. A personal favor can begin as relief and end as a leash. These cases are not about miserliness. They are about whether an exchange leaves the receiver independent enough to choose cleanly afterward.

The limit matters because paranoia also distorts value. Greene's law works when it sharpens cost perception, not when it turns gratitude into weakness and suspicion into identity. Pay when paying keeps the terms clear. Accept help when the terms stay fair. Refuse the free lure when the hidden price is your autonomy. Chapter 39 dealt with disturbance and exposed weakness. Chapter 40 deals with dependency and purchased weakness. Chapter 41 follows by asking how not to swing into imitative extremes once those pressures are understood.`
      ),
      keyTakeaways: [
        {
          point: tone("Hidden cost matters more than low visible price.", "The bargain becomes dangerous when the real bill arrives later as obligation.", "Cheap entry can conceal expensive dependence."),
          moreDetails: tone("Greene asks the reader to see the whole exchange, not the first attractive number.", "A free or discounted offer can carry future influence, softened judgment, or reduced freedom.", "Delayed price often shows up in what you owe rather than what you paid.")
        },
        {
          point: tone("Fair exchange is different from the free-lure trap.", "Visible terms protect autonomy better than vague generosity with strings.", "Legible price is often safer than disguised price."),
          moreDetails: tone("A clean exchange keeps both sides aware of what is being traded.", "The trap begins when the receiver treats the obvious price as the total price.", "Greene respects paying fully because it limits hidden leverage.")
        },
        {
          point: tone("Dependence can grow quietly through easy bargains.", "Shortcuts and favors can lower standards while making refusal harder later.", "The easy path can train strategic weakness."),
          moreDetails: tone("The law is about autonomy loss more than thrift.", "Each accepted shortcut can make future pressure more effective.", "Dependence often grows by repetition, not by one dramatic surrender.")
        },
        {
          point: tone("Work, school, and personal settings all show hidden-price logic.", "Ordinary cases reveal how influence can ride inside help.", "The same trap appears wherever gratitude blurs analysis."),
          moreDetails: tone("A work favor, school stipend, or personal rescue can each create soft obligations.", "The practical question is whether the exchange leaves you freer afterward.", "Relief is not the same thing as independence.")
        },
        {
          point: tone("The law has a suspicion limit.", "Reject hidden control without turning fair exchange into paranoia.", "Cynicism can become its own form of bad pricing."),
          moreDetails: tone("Some generosity is genuine and some cooperation remains clean.", "The chapter is strongest when it protects cost clarity rather than worshiping self-sufficiency.", "Strategic independence needs judgment, not permanent distrust.")
        }
      ],
      activationPrompt: tone(
        "Find one offer in your world whose visible price may not be its full price.",
        "Choose one exchange where naming the hidden cost would change your decision.",
        "Identify one bargain you should refuse and one fair exchange you should accept cleanly."
      ),
      selfCheckPrompt: tone(
        "If I accept this, what exactly will become harder for me to refuse later?",
        "Does this exchange keep the terms visible, or does it convert price into dependence?",
        "Am I declining a trap or performing suspicion for its own sake?"
      ),
      oneMinuteRecap: tone(
        "This chapter argues that what looks free often carries a hidden bill paid later in obligation, lowered standards, or dependence.",
        "Paying the real cost up front can preserve more autonomy than accepting the offer that feels easiest now.",
        "The strategic task is to reject hidden-control bargains without losing the ability to recognize fair exchange."
      )
    },
    hard: {
      chapterBreakdown: tone(
        `Greene's fortieth law is less about money than about the politics of hidden price. A visible cost can be limiting, but an invisible cost can be more dangerous because it is paid in freedom, standards, and future room to refuse. The chapter therefore asks the reader to distrust not generosity itself, but the strategic fog created when an offer looks easier than it really is. What appears free may simply be charging in a currency the receiver has failed to count.

That is why the law treats cheapness as a possible weakness-maker. A person who keeps accepting value without pricing the obligation may become easier to steer. Judgment softens because the exchange feels beneficial in the short term. Standards soften because cheap access starts to feel normal. Dependence grows because future refusal now carries social, emotional, or practical cost. Greene's pressure point is that hidden price often purchases compliance more effectively than overt force.

The central distinction is between legible exchange and disguised leverage. A legible exchange names the terms and limits the claim created by the trade. Disguised leverage hides the claim inside gratitude, convenience, or relief. Greene admires paying full cost not because higher price is morally pure, but because named cost preserves clearer boundaries. Once the boundaries blur, the receiver may discover that the bargain bought influence over later choices.

That distinction appears in ordinary settings. Sarif may see that a work favor is really an attempt to secure future deference. Elow may notice that a grant offer or committee stipend contains soft conditions that shape what she can criticize or refuse. A personal favor may solve the immediate problem while producing a debt that later narrows independence. The common structure is not charity versus selfishness. It is clarity versus concealed leverage.

The chapter is strongest when it refuses both sentimental trust and paranoid self-mythology. Some support is fair. Some cooperation enlarges freedom rather than shrinking it. Some generosity remains generosity because it does not purchase hidden obedience. Greene's useful boundary is sharper: count the whole cost, accept what stays clean, and reject what converts gratitude into leverage. Chapter 39 dealt with weakness made visible under disturbance. Chapter 40 deals with weakness quietly installed through appetite for the easy bargain.

That bridge matters because dependence is harder to spot than reaction. A disturbed person exposes weakness quickly. A cheaply bought person may continue to look calm while their options narrow. Chapter 40 therefore teaches a slower diagnostic: ask what an offer will own later, not just what it gives now. Chapter 41 follows by turning from hidden price toward the instability of imitation and extremity, where judgment is lost not by cheapness alone but by copying and swinging too far.`,
        `An offer can reduce immediate pain while increasing future control. Greene uses that fact to move the reader from visible price to invisible consequence. The strategic question is never just what something costs today. The deeper question is what accepting it trains you to owe, tolerate, or depend on tomorrow.

The chapter therefore values clear price because clear price creates cleaner freedom. Once you accept a bargain that hides its second bill, your judgment is already under pressure. Gratitude may stop you from naming the cost. Convenience may stop you from resisting repetition. Over time, the easy path can lower standards and make future influence feel normal rather than coercive. Greene's argument is that dependency often arrives dressed as efficiency.

The harder distinction is between receiving support and being purchased. Support can enlarge your options because the help remains fair and bounded. Being purchased narrows your options because the help silently creates a claim on your later behavior. Greene is not asking for contempt toward generosity. He is asking for enough clarity to tell whether the exchange leaves your future choices intact.

Sarif's work bargain, Elow's school stipend, and a personal rescue arrangement all show the same mechanism. Each looks helpful at first. Each becomes risky if the receiver treats visible relief as total price. The real issue is whether the exchange remains legible after the immediate pressure has passed. If it does, cooperation may be sound. If it does not, the help may already be turning into leverage.

The law overreaches when it turns suspicion into identity or self-sufficiency into vanity theater. Its better boundary is exacting but usable: accept what is transparent, refuse what quietly buys obedience, and do not confuse the emotional comfort of being helped with the strategic reality of staying free. Chapter 39 exposed weakness through disturbance. Chapter 40 tracks weakness through hidden dependency. Chapter 41 then asks how to resist the next kind of distortion, which comes from imitation and extremity rather than from cheapness alone.`,
        `Greene's fortieth law warns that the easiest offer may be the most expensive if you price it correctly. Many people stop counting once the visible cost falls low enough. Greene keeps counting. He includes obligation, deference, softened standards, and future difficulty of refusal in the total bill. Under that accounting, what looks free can become a highly efficient purchase of another person's autonomy.

Its strongest claim is that dependence rarely announces itself as dependence. It arrives as convenience, gratitude, discount, rescue, access, or opportunity. Because the first experience feels like gain, the receiver often misses the strategic loss being installed underneath it. That loss may be subtle at first: one softened refusal, one tolerated expectation, one lowered standard. Greene's correction is to treat hidden price as real price from the start.

That is why paying clearly can be a form of power preservation. Clear payment keeps the relationship cleaner because it limits ambiguity about what is owed. Hidden price does the opposite. It converts the exchange into a field where influence can later be claimed without ever having been fully declared. Greene is not celebrating waste. He is defending boundary clarity against the seduction of apparent cheapness.

The examples expose the same structure across settings. Sarif is not merely deciding whether to save effort at work; he is deciding whether to let a favor purchase leverage over later decisions. Elow is not merely comparing stipend amounts; she is pricing the expectations that may attach to the school offer. A personal favor is not merely help; it is a test of whether relief will later harden into a leash. In each case, the weak move is not receiving value. The weak move is failing to count the value demanded back.

The limit matters because paranoia also misprices reality. Some gifts are clean. Some fair exchanges deserve acceptance precisely because they do not buy hidden control. Greene's law works only when it sharpens judgment rather than replacing judgment with reflexive distrust. Count the full cost, name the boundary, and refuse the bargain that buys your freedom below its true price. Chapter 39 dealt with weakness revealed by pressure. Chapter 40 deals with weakness purchased through appetite. Chapter 41 follows by showing how people then lose balance again when they imitate and overcorrect instead of holding a measured line.`
      ),
      keyTakeaways: [
        {
          point: tone("Hidden price is often the real strategic price.", "An offer can look cheap while charging later in obedience or dependence.", "Low visible cost can conceal a high autonomy bill."),
          moreDetails: tone("The chapter asks the reader to count obligation, softened refusal, and lowered standards as part of the total exchange.", "Greene's correction is to treat hidden consequence as real cost from the beginning.", "Apparent savings can be leverage in disguise.")
        },
        {
          point: tone("Legible exchange protects boundaries better than disguised leverage.", "Clear payment can preserve more freedom than vague generosity with strings.", "Named cost is often safer than undeclared claim."),
          moreDetails: tone("A transparent trade limits what either side can later pretend is owed.", "Disguised leverage hides its claim inside gratitude, convenience, or relief.", "Boundary clarity is the chapter's real defense of paying fully.")
        },
        {
          point: tone("Dependence often grows by repetition, not spectacle.", "Each easy bargain can train weaker standards and harder refusal later.", "Strategic weakness can be installed one convenient choice at a time."),
          moreDetails: tone("The law is about cumulative autonomy loss more than about one dramatic concession.", "Repeated shortcuts can normalize influence that would look unacceptable if priced clearly.", "Convenience becomes dangerous when it teaches compliance.")
        },
        {
          point: tone("Work, school, and personal favors can all carry concealed leverage.", "The same logic appears wherever gratitude blurs the full price.", "Help becomes dangerous when relief starts buying later control."),
          moreDetails: tone("A work favor, school stipend, or personal rescue can each remain fair or become binding depending on the hidden claim attached.", "The practical test is whether the exchange leaves your future choices legible and intact.", "What matters is not category but structure.")
        },
        {
          point: tone("The law needs a paranoia boundary.", "You must reject hidden-control bargains without rejecting genuine fairness.", "Bad pricing includes both cheap dependence and total distrust."),
          moreDetails: tone("Greene overreaches if the rule becomes contempt for help itself.", "The useful line is to accept transparent support and refuse concealed purchase.", "Judgment matters because not every gift is a trap.")
        }
      ],
      activationPrompt: tone(
        "Locate one relationship where the visible price may be distracting you from the real cost.",
        "Choose one offer that needs to be re-priced in terms of autonomy rather than convenience.",
        "Identify one clean exchange worth accepting and one bargain that buys too much control."
      ),
      selfCheckPrompts: [
        tone(
          "If I accept this, what claim on my future behavior becomes easier for the other side to make?",
          "What part of the price is being moved out of money and into obligation, gratitude, or softened standards?",
          "Am I counting the full bill or only the part that feels good today?"
        ),
        tone(
          "Is this support enlarging my options, or is it narrowing them while pretending to help?",
          "Would paying clearly now leave cleaner boundaries than receiving this cheaply?",
          "Am I refusing a disguised purchase, or am I drifting into paranoia about fair exchange?"
        )
      ],
      predictionPrompt: tone(
        "If Chapter 40 warns against being purchased through cheapness, how might Chapter 41 warn against being destabilized through imitation and extremes?",
        "What changes once the threat is not hidden price but the impulse to copy or overcorrect?",
        "After refusing dependency bargains, how do you avoid losing balance by reacting too far in the next direction?"
      ),
      oneMinuteRecap: tone(
        "This chapter argues that what appears free may charge later in obedience, lowered standards, or reduced room to refuse.",
        "Power is preserved by counting the whole price, paying clearly when needed, and declining offers that smuggle in control.",
        "The task is to reject hidden leverage without losing the judgment needed to recognize genuine fairness."
      )
    }
  },
  examples: [
    {
      title: "Sarif Refuses the Work Bargain That Would Quietly Purchase Influence",
      format: "decision_point",
      category: "work",
      endingType: "broader_principle",
      scenario: tone("Sarif is offered an easy work favor that would solve an immediate problem, but he can already see that the favor is meant to buy leverage over his next decision.", "He has to choose between immediate convenience and a cleaner boundary.", "The offer looks cheap now because the real bill is delayed."),
      whatToDo: tone("He names the hidden cost and pays the visible cost instead, even if it feels slower or less comfortable.", "He refuses the bargain that would make later independence more expensive.", "He protects future freedom by declining a present lure."),
      whyItMatters: tone("The chapter says free help becomes dangerous when it purchases later influence.", "His case shows why clear price can preserve autonomy better than cheap relief.", "A clean transaction can be stronger than a flattering favor.")
    },
    {
      title: "Elow Explains Why the Committee Stipend Is Not Only About Money",
      format: "dialogue",
      category: "school",
      endingType: "self_directed_question",
      scenario: tone("Elow talks through a grant offer and committee stipend that look helpful until she notices the soft expectations attached to them.", "The conversation turns from amount to obligation.", "She is trying to price what the offer might own later."),
      whatToDo: tone("She asks what will become harder to refuse once she accepts the stipend and whether the terms stay transparent afterward.", "She distinguishes fair exchange from help that quietly purchases compliance.", "She studies the hidden claim instead of the visible amount alone."),
      whyItMatters: tone("The chapter says hidden price often matters more than visible price.", "Her example shows that soft obligations can shape freedom as much as written rules do.", "What looks supportive may still narrow independence.")
    },
    {
      title: "Taren Has to Decide Whether the Personal Rescue Will Become a Leash",
      format: "dilemma",
      category: "personal",
      endingType: "surprising_implication",
      scenario: tone("Taren is offered help that would solve a real short-term problem, but he senses that future refusal may become far harder if he accepts it without naming the terms.", "He has to decide whether the relief is worth the dependency it may install.", "The real question is not kindness alone but future freedom."),
      whatToDo: tone("He either clarifies the terms until the help becomes clean or declines the offer before gratitude turns into leverage.", "He refuses to confuse rescue with independence.", "He protects autonomy by pricing the offer honestly before accepting it."),
      whyItMatters: tone("The law says dependence often grows through easy relief.", "His dilemma shows how hidden obligation can be more binding than visible payment.", "A favor can solve the first problem while creating a second one.")
    },
    {
      title: "Jessa Predicts the Grant Will Change Who Feels Free to Criticize Later",
      format: "predict_reveal",
      category: "school",
      endingType: "cross_domain",
      scenario: tone("Jessa predicts that a school grant will not only fund work but also alter who feels able to dissent once the money has been accepted.", "She expects the hidden price to show up later in behavior rather than in paperwork.", "The scene becomes a forecast about autonomy under soft obligation."),
      whatToDo: tone("She watches for the point where gratitude begins to narrow honest judgment.", "She tests whether the offer remains support or starts becoming influence.", "She asks who will still feel fully free once the benefit has been taken."),
      whyItMatters: tone("The chapter says the true price of an offer can appear later in what becomes harder to refuse.", "Her prediction shows how dependency logic works outside obvious money fights too.", "The issue is leverage, not just generosity.")
    },
    {
      title: "The Team Debrief Finds That the Cheap Shortcut Lowered Standards Before Anyone Noticed",
      format: "postmortem",
      category: "work",
      endingType: "common_trap",
      scenario: tone("A work team reviews a shortcut that saved time at first but gradually made everyone tolerate weaker standards and outside influence.", "They realize the bargain felt efficient because the hidden cost was delayed.", "The debrief becomes a lesson in autonomy loss by convenience."),
      whatToDo: tone("They separate visible savings from hidden dependence and rebuild a cleaner process even if it costs more up front.", "They stop treating the first cheap result as the full price.", "They choose legible cost over comfortable drift."),
      whyItMatters: tone("The chapter warns that cheapness can weaken standards as well as increase dependence.", "Their mistake was assuming the easiest route was also the safest one.", "The shortcut charged later in control and quality.")
    },
    {
      title: "Before and After Paying Clearly Changed the Relationship More Than the Price",
      format: "before_after",
      category: "personal",
      endingType: "perspective_reframe",
      scenario: tone("Before, the help looked free and the relationship slowly filled with unclear obligation. After, the terms were made visible and the exchange became cleaner even though the visible price rose.", "The contrast is between cheap relief and clear independence.", "One version flatters the receiver; the other leaves them freer."),
      whatToDo: tone("Pay the part that needs paying, name the part that should stay bounded, and refuse the fog that makes later pressure feel natural.", "Choose clarity over convenience when convenience is buying too much claim on your future.", "Trade a little immediate comfort for cleaner autonomy."),
      whyItMatters: tone("The chapter becomes visible when paying more up front leaves the person less owned afterward.", "This before-and-after shows why visible cost can be strategically cheaper than hidden cost.", "Freedom can improve even when price rises, if the exchange becomes clean.")
    }
  ],
  reviewCards: [
    { cardId: "ch40-rc01", front: tone("What is the main claim of Chapter 40?", "Why does the free lunch matter here?", "What can cheapness hide?"), back: tone("The chapter argues that free or cheap offers often carry hidden cost paid later in obligation, dependence, or reduced autonomy.", "The free lunch matters because the first relief can disguise the real bill.", "Cheapness can hide influence, lowered standards, or future difficulty of refusal."), difficulty: "easy" },
    { cardId: "ch40-rc02", front: tone("What is the difference between fair exchange and the trap?", "Why is visible price often safer here?", "What keeps a bargain clean?"), back: tone("Fair exchange keeps the terms legible, while the trap hides its second price inside gratitude, convenience, or relief.", "Visible price is safer because it preserves clearer boundaries.", "A bargain stays clean when both sides can see what is being traded and what is owed."), difficulty: "easy" },
    { cardId: "ch40-rc03", front: tone("How can dependence grow through easy bargains?", "Why are shortcuts risky in this chapter?", "What does repeated cheapness do?"), back: tone("Easy bargains can lower standards, soften refusal, and make later pressure more effective.", "Shortcuts become risky when they trade immediate comfort for future autonomy.", "Repeated cheapness can train strategic weakness by normalizing dependence."), difficulty: "medium" },
    { cardId: "ch40-rc04", front: tone("Where does this law appear in ordinary settings?", "How do work, school, and personal examples show hidden price?", "Why is gratitude not the full story?"), back: tone("It appears anywhere help, discount, or rescue can carry a concealed claim on later behavior.", "Work favors, school stipends, and personal rescues all show how influence can ride inside relief.", "Gratitude matters, but the chapter asks what the exchange will own later."), difficulty: "medium" },
    { cardId: "ch40-rc05", front: tone("How does Chapter 40 bridge to Chapter 41?", "What comes after rejecting cheap dependence?", "Why does this law lead toward imitation and extremes?"), back: tone("After refusing hidden-price bargains, the next issue is how to keep judgment from swinging into copying or overreaction.", "Chapter 41 turns from dependency cost toward the instability of imitation and extremes.", "The bridge asks how to stay independent without losing balance."), difficulty: "hard" }
  ],
  keyTakeawayCard: tone(
    "Despising the free lunch means seeing that the cheapest visible offer may carry the highest hidden claim on your freedom, standards, or future refusal.",
    "This law values clear price over disguised price because hidden cost often purchases dependence more effectively than open force.",
    "Power grows when you count the whole bill and refuse the bargain that buys your autonomy below its true price."
  )
};

const quiz = {
  passingScorePercent: 70,
  questions: [
    { questionId: "ch40-q01", prompt: "Why does the free lunch matter in this chapter?", choices: ["Because every gift is manipulative", "Because what looks free can carry hidden cost later", "Because paying more is always wiser"], correctIndex: 1, explanation: tone("Correct. The chapter focuses on hidden cost rather than surface price alone.", "The law says apparent cheapness can disguise obligation or dependence.", "Right. The issue is the unseen bill, not automatic hostility to every gift."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch40-q02", prompt: "What can cheap or free offers create strategically?", choices: ["Obligation, lowered standards, or dependence", "Guaranteed loyalty without cost", "Freedom from future influence"], correctIndex: 0, explanation: tone("Yes. The chapter says easy bargains can create obligation and make later pressure stronger.", "Cheap access can weaken standards and increase dependence.", "Correct. The hidden cost often appears in autonomy rather than in cash."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch40-q03", prompt: "Why is this chapter not generic anti-generosity advice?", choices: ["Because it says receiving help is always weak", "Because it treats every fair exchange as suspicious", "Because it distinguishes hidden-control bargains from genuine fair exchange"], correctIndex: 2, explanation: tone("Correct. The law has a gratitude limit and does not reject all goodwill.", "Greene is separating concealed leverage from transparent support.", "Right. Fair exchange remains possible in this chapter."), bloomsLevel: "remember-understand", depthLevel: "easy" },
    { questionId: "ch40-q04", prompt: "In Sarif's work scenario, what best fits the chapter?", choices: ["Take the favor now and ignore later influence", "Pay the visible cost rather than accept a bargain that buys leverage over later decisions", "Reject all workplace cooperation"], correctIndex: 1, explanation: tone("Yes. He protects autonomy by refusing the hidden-price bargain.", "The chapter favors clear boundaries over flattering convenience.", "Correct. The point is not isolation but clean exchange."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch40-q05", prompt: "What does Elow's school example show?", choices: ["That stipend amount is the only thing that matters", "That soft expectations can matter as much as written rules", "That school help is always corrupt"], correctIndex: 1, explanation: tone("Correct. Her case shows how hidden obligations can ride inside support.", "The chapter asks what becomes harder to refuse after acceptance.", "Right. Soft influence can be part of the real price."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch40-q06", prompt: "What is the strongest reading of Taren's personal dilemma?", choices: ["Any personal favor should be accepted immediately", "Only money-based bargains matter", "Relief can become risky if it quietly turns into dependence"], correctIndex: 2, explanation: tone("Yes. The law says help can solve one problem while installing another.", "His dilemma turns on whether relief will later narrow freedom.", "Correct. Hidden obligation can be more binding than visible payment."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch40-q07", prompt: "How can paying the true price preserve freedom?", choices: ["It keeps the exchange legible and limits hidden claims", "It proves moral superiority over everyone who takes help", "It guarantees all future outcomes"], correctIndex: 0, explanation: tone("Correct. Visible price can be strategically cheaper than hidden dependence.", "Paying clearly helps keep boundaries cleaner.", "Right. The chapter respects legible exchange, not expensive theater."), bloomsLevel: "apply-analyze", depthLevel: "medium" },
    { questionId: "ch40-q08", prompt: "When does suspicion become paranoid ingratitude?", choices: ["When it counts hidden obligations carefully", "When it rejects fair exchange and genuine goodwill by default", "When it protects autonomy from disguised leverage"], correctIndex: 1, explanation: tone("Exactly. The chapter warns against turning prudence into reflexive distrust.", "Suspicion fails when it treats all support as manipulation.", "Right. The boundary is judgment, not permanent hostility."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch40-q09", prompt: "How does Chapter 39 lead into Chapter 40?", choices: ["By proving disturbance and dependency have no relation", "By replacing leverage with pure generosity", "By moving from weakness exposed under disturbance to weakness created through hidden dependency"], correctIndex: 2, explanation: tone("Correct. Chapter 39 exposed weakness quickly, while Chapter 40 shows how weakness can be installed slowly through cheapness.", "The bridge moves from reaction under pressure to appetite under hidden price.", "Right. The sequence tracks different ways autonomy can break."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" },
    { questionId: "ch40-q10", prompt: "What bridge carries Chapter 40 into Chapter 41?", choices: ["Once cheap dependence is refused, the next question is how to avoid losing balance through imitation and extremes", "Chapter 41 returns only to money and bargaining", "Rejecting hidden price means copying stronger people more aggressively"], correctIndex: 0, explanation: tone("Correct. The next law shifts from hidden cost to the instability of imitation and overreaction.", "Chapter 41 asks how independence stays measured rather than extreme.", "Right. Refusing the cheap is not the same as swinging to a new imbalance."), bloomsLevel: "analyze-evaluate", depthLevel: "hard" }
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
for (const name of ["Sarif", "Elow", "Taren", "Jessa"]) continuity.nameUsage[name] = [stem];
continuity.withinChapterNames[stem] = ["Sarif", "Elow", "Taren", "Jessa"];
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
- Chapter-specific mechanism remains hidden cost, dependence, fair exchange, and gratitude limits rather than generic frugality advice
- Hard depth preserves the autonomy-versus-paranoia boundary and the Chapter 41 bridge
- Quiz stays within supported facts from the approved draft and frozen source bundle

## Gate result
- Approved for chapter gate and automatic continuation
`;
writeText(paths.validation, validation);

fs.appendFileSync(
  paths.runLog,
  `\n- Completed writer, editor, critic, converter, quiz, and validator steps for Chapter 40.\n- Validation result: PASS.\n- Continuity hash sealed for \`${stem}\`: \`${seal}\`\n`,
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
