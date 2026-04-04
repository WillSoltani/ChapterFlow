#!/usr/bin/env node
/**
 * Generates moreDetails tone objects for ALL keyTakeaways in Chapter 6
 * ("If You Don't Do This, You Are Headed for Trouble") of
 * "How to Win Friends and Influence People" — medium and hard variants.
 */

import { readFileSync, writeFileSync } from "fs";

const FILE_PATH = new URL(
  "../../book-packages/friends-and-influence.modern.json",
  import.meta.url
).pathname;

const data = JSON.parse(readFileSync(FILE_PATH, "utf-8"));
const ch6 = data.chapters[5]; // chapter 6 is index 5

// ─────────────────────────────────────────────
// MEDIUM variant — 6 keyTakeaways
// ─────────────────────────────────────────────
const mediumMoreDetails = [
  // [0] A name is identity, not a label
  {
    gentle:
      "Carnegie's chapter builds on a simple neurological fact: hearing your own name triggers a different kind of processing than hearing a generic greeting. The brain treats it as a signal that the interaction is personally relevant, not transactional. Jim Farley did not carry a list of ten thousand names because he had a photographic memory. He carried them because he understood that each name was a door into a relationship, and leaving the door unnamed meant it stayed closed.",
    direct:
      "Self-referential processing is what separates a name from a title. When someone hears their name, the brain shifts from passive reception to active engagement. Carnegie's observation aligns with what neuroscience later confirmed: names activate medial prefrontal regions tied to self-identity. Farley's ten-thousand-name recall was not a parlor trick. It was a strategic investment in making each person feel individually addressed rather than categorically handled.",
    competitive:
      "A name forces the listener's brain out of autopilot. Generic address lets them coast through the interaction half-present. Their own name pulls them in because the brain processes it as personally significant. Farley leveraged this across ten thousand people and built a political network no competitor could match. The asymmetry is steep: remembering costs you three seconds of attention, while forgetting costs you the entire relationship.",
  },
  // [1] Hearing a name requires attention, not talent
  {
    gentle:
      "Carnegie is careful to separate the act of remembering from the ability to remember. Most people walk away from an introduction without the name, not because their memory failed, but because their attention was pointed inward. They were rehearsing their own introduction, planning a witty remark, or scanning the room. Farley's method was the opposite: he gave his full focus to the other person for the first few seconds, and the name landed naturally.",
    direct:
      "The bottleneck is encoding, not retrieval. A name that never enters working memory cannot be recalled later, regardless of how strong your long-term storage is. Carnegie diagnosed this correctly: the failure point is the introduction itself, where most people allocate attention to self-presentation instead of reception. Farley's advantage was not capacity. It was the discipline to shift attention outward during the three-second window when the name was spoken.",
    competitive:
      "Blaming memory for forgotten names is a convenient fiction. The real failure is attentional allocation during the introduction. Farley outperformed everyone around him not because his brain was better but because his attention was aimed at the other person while theirs was aimed at themselves. That discipline is trainable and free, which means anyone who still blames memory is choosing the excuse over the fix.",
  },
  // [2] Names matter even in brief interactions
  {
    gentle:
      "The people who expect to be invisible are the ones most moved by recognition. A cashier who hears their name from a customer experiences something rare in their workday: evidence that they registered as a human being, not a function. Carnegie understood that these brief exchanges carry disproportionate weight because the person receiving the name almost never expects it.",
    direct:
      "Recognition carries more weight where it is scarce. A CEO hears their name dozens of times a day. A parking attendant might not hear theirs once. Carnegie's principle scales inversely with social visibility: the less recognition someone typically receives, the stronger the response when you provide it. The cost is negligible. The return, measured in goodwill and cooperation, outpaces any equivalent time investment.",
    competitive:
      "Most people reserve name-level attention for those above them in a hierarchy and default to generic address for everyone below. That pattern leaves a vacuum of recognition at every low-visibility touchpoint. Filling that vacuum costs seconds and produces loyalty from people who control access, information, and small favors that accumulate over time. The overlooked barista who knows your name is also the one who flags you when the line is short.",
  },
  // [3] Carnegie named things after people for a reason
  {
    gentle:
      "When Carnegie put J. Edgar Thomson's name on a steel plant, he was doing more than flattery. He was binding the man's identity to a physical outcome. Once your name sits on a building, its success and your reputation become intertwined. Thomson could not walk away from the deal without walking away from something that carried his name. That psychological bond ran deeper than any contractual obligation.",
    direct:
      "Naming a steel plant after Thomson converted a business negotiation into an identity investment. Thomson's self-image became linked to the plant's success, which meant opposing the deal would feel like opposing himself. Carnegie exploited the same principle Napoleon III used when he boasted of remembering every person he met: tying your name to something external makes withdrawal psychologically expensive.",
    competitive:
      "Carnegie did not name the Thomson Steel Works out of generosity. He named it because doing so made Thomson a stakeholder at the identity level. Walking away from a contract is a business decision. Walking away from a building with your name on it is a personal one. That shift from transactional to personal is what gave Carnegie the edge. The naming cost him nothing and bought him commitment that no financial incentive could replicate.",
  },
  // [4] This connects to Chapters 4 and 5
  {
    gentle:
      "Interest, warmth, and personalization each carry weight on their own. But Carnegie arranged them as a sequence for a reason. Genuine interest (Chapter 4) opens the door. A real smile (Chapter 5) makes the person feel safe. Using their name (this chapter) tells them they are a specific individual, not a generic audience. Most people receive one of these in a given interaction. Receiving all three together is uncommon enough to be memorable.",
    direct:
      "The recognition sequence operates on three channels: cognitive (interest), emotional (smile), and identity (name). Each channel targets a different layer of the person's experience. Interest says you are paying attention. The smile says you are glad to be present. The name says you see them as a distinct person. Delivering all three in sequence creates a composite signal that is significantly rarer than any single component.",
    competitive:
      "Stacking interest, warmth, and a name creates a recognition signal most people encounter so rarely that it stands out immediately. Each element alone is common. The combination is not. That scarcity is the advantage. One interaction where you deliver all three outweighs five where you deliver only one. The cost difference is negligible. The impression difference is not.",
  },
  // [5] If you forget a name, ask again right away
  {
    gentle:
      "Carnegie's advice on forgotten names is about timing, not technique. Within the first thirty seconds, asking again reads as care: you wanted to get it right. After a few minutes, it reads as indifference: you did not bother to hold on to it. The discomfort of admitting you missed the name is real but brief, and it is far smaller than the cost of spending months avoiding someone whose name you never learned.",
    direct:
      "The recovery window for a forgotten name closes fast. At thirty seconds, re-asking signals attentiveness. At five minutes, it signals negligence. Carnegie's principle here is about loss prevention: a name recovered in the first half-minute is an asset you can use for years. A name lost to avoidance becomes a compounding social liability every time you encounter that person.",
    competitive:
      "Most people who forget a name choose the comfort of silence over the brief sting of re-asking. That choice trades a three-second recovery for a permanent gap. Carnegie's strategy is explicit: absorb the momentary awkwardness and lock in the name while the window is open. The people who re-ask within thirty seconds walk away with a usable asset. The people who hesitate walk away with a liability they can never quietly fix.",
  },
];

// ─────────────────────────────────────────────
// HARD variant — 8 keyTakeaways
// ─────────────────────────────────────────────
const hardMoreDetails = [
  // [0] A name activates identity, not just recognition
  {
    gentle:
      "When Farley recalled ten thousand names, each person experienced something that went beyond being remembered. They felt individually significant. Carnegie understood that a name is not information you retrieve; it is a signal that tells the other person their existence registered as distinct. That signal changes the quality of the entire interaction because the person stops performing for a stranger and starts engaging with someone who sees them.",
    direct:
      "Hearing your own name activates self-referential neural pathways that generic address does not reach. The listener's brain shifts from passive processing to active personal engagement. Farley's ten-thousand-name capacity worked because each recall triggered this shift in the recipient. The effect is involuntary. The person cannot choose to ignore the signal. Their brain has already processed it as personally relevant before conscious evaluation begins.",
    competitive:
      "A name bypasses the listener's cognitive filters and forces personal engagement. Farley used this involuntary response across ten thousand people to build a political operation no rival could replicate. The advantage is biological: the brain treats its own name as a priority input. Anyone who addresses you generically is competing against that reflex with nothing.",
  },
  // [1] Most name forgetting is an attention failure, not a memory failure
  {
    gentle:
      "Carnegie makes the diagnosis precise: the name was spoken clearly, but you were not listening. Your attention was on yourself, rehearsing your own introduction or planning what to say next. Farley did not have a superior brain. He had superior discipline in those first few seconds. He pointed his attention at the other person while everyone else pointed theirs inward. That single redirection is what separated a ten-thousand-name networker from the rest.",
    direct:
      "The encoding failure occurs at the attention gate, not in storage or retrieval. During an introduction, most people allocate cognitive resources to self-monitoring: How do I look? What should I say next? The incoming name competes against those internal processes and loses. Farley eliminated the competition by suspending self-focused processing for the duration of the introduction. His recall was a downstream effect of that attentional choice.",
    competitive:
      "Farley's edge was not genetic. It was attentional. While his peers burned cognitive resources on self-presentation during introductions, he redirected those resources toward the incoming name. The result was ten thousand stored names against a field of people who could barely manage ten. The fix is a three-second attentional shift anyone can learn, which means the gap between Farley-level performance and average performance is entirely a matter of discipline.",
  },
  // [2] Carnegie's naming strategy turns transactions into personal bonds
  {
    gentle:
      "Naming the steel plant after Thomson was not flattery. It was a psychological binding operation. Once Thomson's name was physically attached to a building, his identity and the building's fate became linked. Walking away from the deal would have meant walking away from something that carried his name, and that kind of withdrawal costs more than money. It costs a piece of self-image. Carnegie understood that identity, once attached, resists separation.",
    direct:
      "Carnegie converted a commercial negotiation into an identity commitment by naming the plant after Thomson. The mechanism is straightforward: once a person's name is physically attached to an outcome, opposing that outcome becomes psychologically equivalent to opposing themselves. Thomson could not reject the deal without rejecting something that bore his identity. That bind operated independently of the contract terms.",
    competitive:
      "The Thomson Steel Works naming was a move that cost Carnegie nothing and purchased commitment at the identity level. Thomson could renegotiate price, delay timelines, or change terms. What he could not do was walk away from a building with his name on it without feeling like he was abandoning part of himself. Carnegie exploited the gap between rational decision-making and identity-driven loyalty, and that gap is where the real leverage sits.",
  },
  // [3] Using a name in low-stakes moments builds trust for high-stakes ones
  {
    gentle:
      "Trust does not appear on demand. It accumulates through repeated small signals that you see the other person as an individual. Using someone's name during routine interactions, a hallway greeting, a brief email, a passing comment, deposits evidence that they matter to you. When you eventually need something significant from them, those deposits form the foundation. Carnegie's lesson here is about consistency: the name used ten times in passing outweighs the name used once in a pitch.",
    direct:
      "Name use in low-stakes contexts functions as a trust deposit. Each instance signals personal recognition without requesting anything in return. Over time, these deposits build a balance the other person draws on when evaluating whether to grant a significant request. The compounding effect means that ten casual name uses across three months create a stronger relational base than one name use in a high-pressure meeting.",
    competitive:
      "Most people only remember names when they want something, and the other person can feel the difference. Consistent name use in zero-stakes moments builds a trust balance that is already available when you need it. The person who has heard you say their name a dozen times in passing is predisposed to help you before you ask. The person who hears it for the first time during a request sees the name as a tool, not a signal.",
  },
  // [4] Misspelling or mispronouncing a name is worse than forgetting it
  {
    gentle:
      "A forgotten name says you were careless. A mangled name says something worse: you tried to remember and still got it wrong. The person hears that they were important enough to attempt but not important enough to verify. Carnegie's implicit advice here is that the effort to get the name right must include confirming accuracy. Napoleon III reportedly spent time after each introduction writing down names and reviewing them. That verification step is where most people cut corners.",
    direct:
      "Mispronunciation or misspelling sends a compound negative signal: attempted recognition plus failed execution. The recipient interprets this as evidence that they ranked high enough to notice but not high enough to double-check. Napoleon III's habit of writing names down after introductions addressed this exact failure point. Five seconds of verification at the time of introduction eliminates the risk of delivering a mangled version later.",
    competitive:
      "Getting a name wrong is an unforced error with outsized consequences. The person does not credit you for trying. They penalize you for failing. Napoleon III understood this and built a verification step into every introduction. The cost of asking \"Could you spell that for me?\" is trivial. The cost of mispronouncing someone's name in front of their colleagues follows you for months.",
  },
  // [5] Asking for a name a second time is strength, not weakness
  {
    gentle:
      "The fear of looking forgetful stops most people from re-asking. But Carnegie's logic reverses the equation: asking within thirty seconds tells the other person you care enough to get it right. Waiting and hoping you will catch the name later tells them you would rather gamble on overhearing it than admit you missed it. The brief discomfort of re-asking lasts seconds. The cost of losing the name lasts as long as you know the person.",
    direct:
      "Re-asking within the first thirty seconds is parsed as attentiveness because the introduction is still contextually active. The same request after five minutes is parsed as negligence because the expectation is that you should have retained it by then. Carnegie's strategy exploits this timing asymmetry: a fast recovery costs almost nothing socially, while a delayed recovery carries significant reputational cost.",
    competitive:
      "The thirty-second re-ask is a calculated move that most people are too socially anxious to execute. That anxiety creates the gap: the people willing to absorb three seconds of awkwardness walk away with a name they can use indefinitely. The people who avoid the discomfort walk away with nothing and spend months dodging situations where the missing name becomes obvious.",
  },
  // [6] This completes the recognition sequence from Chapters 4 and 5
  {
    gentle:
      "Carnegie built Part Two of the book as a layered sequence, and this chapter completes it. Genuine interest (Chapter 4) tells someone you are paying attention. A real smile (Chapter 5) tells them you are glad to be there. Using their name tells them they exist as a specific person in your awareness. Each layer addresses a different need, and together they produce an experience most people rarely encounter in a single interaction.",
    direct:
      "The three-layer recognition sequence targets distinct psychological channels. Interest addresses the need for attention. The smile addresses the need for warmth. The name addresses the need for individual identity. Each layer is independently effective, but the combination produces a composite signal that is significantly harder for the recipient to dismiss or forget. The rarity of receiving all three simultaneously is what makes the sequence disproportionately powerful.",
    competitive:
      "Interest, warmth, and personalization form a sequence that most people deliver piecemeal, if at all. Stacking all three in one interaction creates a recognition experience so uncommon that the recipient assigns you a higher value than anyone else they met that day. The individual elements are table stakes. The stack is the differentiator, and almost nobody delivers it consistently.",
  },
  // [7] This chapter is not a memory trick
  {
    gentle:
      "Carnegie's deeper point is that the effort itself carries the message. When someone watches you work to remember their name, ask for the correct spelling, or repeat it to confirm pronunciation, they draw a conclusion that has nothing to do with your mnemonic technique. They conclude that they mattered enough for you to bother. That conclusion shapes how they feel about you more than any specific thing you say.",
    direct:
      "The signal is not the name. The signal is the visible effort to retain the name. Carnegie's chapter functions as a respect-signaling protocol where the technique is secondary to the meta-message: this person invested cognitive resources in remembering me. The recipient processes that investment as evidence of personal significance, which produces reciprocal goodwill independent of whatever words follow.",
    competitive:
      "Reducing this chapter to a memory hack misses the real leverage. The other person does not evaluate your technique. They evaluate your investment. Visible effort to remember a name sends a status signal that says \"you ranked high enough in my attention to warrant this work.\" That signal produces loyalty and reciprocity that no shortcut or workaround can generate. The effort is the product, not the byproduct.",
  },
];

// ─────────────────────────────────────────────
// Apply moreDetails to the chapter
// ─────────────────────────────────────────────
const mediumKT = ch6.contentVariants.medium.keyTakeaways;
const hardKT = ch6.contentVariants.hard.keyTakeaways;

if (mediumKT.length !== mediumMoreDetails.length) {
  throw new Error(
    `Medium mismatch: ${mediumKT.length} takeaways vs ${mediumMoreDetails.length} moreDetails`
  );
}
if (hardKT.length !== hardMoreDetails.length) {
  throw new Error(
    `Hard mismatch: ${hardKT.length} takeaways vs ${hardMoreDetails.length} moreDetails`
  );
}

mediumKT.forEach((kt, i) => {
  kt.moreDetails = mediumMoreDetails[i];
});

hardKT.forEach((kt, i) => {
  kt.moreDetails = hardMoreDetails[i];
});

writeFileSync(FILE_PATH, JSON.stringify(data, null, 2) + "\n", "utf-8");

console.log("Done. Added moreDetails to Chapter 6:");
console.log(`  medium: ${mediumMoreDetails.length} keyTakeaways`);
console.log(`  hard:   ${hardMoreDetails.length} keyTakeaways`);
