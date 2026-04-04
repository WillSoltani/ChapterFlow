import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const filePath = resolve('/Users/willsoltani/dev/chapterflow-siliconx/book-packages/friends-and-influence.modern.json');
const data = JSON.parse(readFileSync(filePath, 'utf-8'));

// Find chapter 5 (number: 5)
const ch5 = data.chapters.find(c => c.number === 5);
if (!ch5) {
  console.error('Chapter 5 not found');
  process.exit(1);
}

// ── Medium moreDetails (6 takeaways) ──────────────────────────────

const mediumMoreDetails = [
  // 1: "Your face speaks first."
  {
    gentle: "Carnegie opens with Charles Schwab for a reason. Schwab ran one of the largest steel operations in America and credited his smile with more career value than his technical expertise. The people across the table from him had equal knowledge of metallurgy and logistics. What they lacked was the immediate signal of warmth that lowered defenses before the first word was spoken. Your face communicates a verdict about the interaction before your voice has a chance to present evidence.",
    direct: "Schwab's claim that his smile was worth a million dollars is backed by observable results: people opened up faster, negotiations moved forward with less friction, and trust formed before the pitch even started. The neurological explanation is simple. The brain processes facial expressions before it processes speech. A flat expression triggers a guardedness response in the other person. A genuine smile triggers an openness response. The conversation inherits whichever signal arrived first.",
    competitive: "Schwab competed against industrialists who outmatched him on technical knowledge. His edge was that he won the emotional opening before anyone realized the negotiation had started. Most people enter rooms with a blank face and then spend ten minutes trying to build rapport through words. That is playing catch-up against a deficit your own expression created. Controlling the first signal your face sends is the lowest-cost, highest-return move available in any interaction."
  },
  // 2: "Feeling follows action."
  {
    gentle: "William James proposed something that quietly reverses how most people think about emotions. The common assumption is that you smile because you feel happy. James showed that the relationship also runs in the other direction: the physical act of smiling can generate the feeling it is supposed to reflect. This means warmth is not something you have to wait for. You can set it in motion with your body and let the feeling catch up on its own terms.",
    direct: "William James identified a proprioceptive feedback loop between facial muscles and emotional processing. When you smile, the physical configuration sends a signal to the brain that shifts your internal state toward warmth. Carnegie used this finding to dismantle the most common objection to his advice: that you cannot smile when you do not feel like it. James proved you can, and the feeling follows the action within seconds rather than minutes.",
    competitive: "Most people treat their mood as a fixed input and their behavior as the output. William James flipped the equation: behavior is the input, mood is the output. People who understand this have a built-in advantage because they never wait for external conditions to produce the right emotional state. They generate it on demand through physical action. That asymmetry compounds over every interaction in a day."
  },
  // 3: "A smile is not a mask."
  {
    gentle: "Carnegie takes care to separate what he is asking from what it might sound like. He is not asking you to paste a grin on your face and pretend everything is wonderful. He is pointing out that most people carry more genuine warmth than their face ever displays. The gap between your internal state and your visible expression is where the work lives. Closing that gap is an act of honesty, not performance.",
    direct: "A real smile engages the orbicularis oculi, the muscles around the eyes, which is something a performed smile does not consistently activate. The brain of the person looking at you processes this difference below conscious awareness and classifies the expression as either trustworthy or suspicious. Carnegie understood this distinction before the research had a name for it. His instruction is precise: let your real warmth show. If the warmth is not there, do not fake the expression.",
    competitive: "A fake smile is detected in under two seconds by most people, and the penalty is steep: you lose more credibility than if you had shown no expression at all. The difficulty of producing a genuine smile is what makes it valuable as a trust signal. It cannot be counterfeited efficiently, which means the person who invests the internal work to mean it holds an advantage that performers cannot replicate."
  },
  // 4: "A smile is genuine interest made visible."
  {
    gentle: "Chapter 4 asked you to become genuinely interested in other people. This chapter asks you to let that interest cross the boundary between what you feel inside and what the other person can actually see. Warmth that stays hidden helps no one. A smile is the bridge that carries your internal regard to the person standing in front of you, turning a private feeling into a shared experience.",
    direct: "Interest without a visible signal is functionally the same as indifference to the person on the receiving end. They cannot read your thoughts. They can only read your face. Chapter 4 built the internal engine of genuine curiosity. Chapter 5 provides the output channel. The two chapters work as a pair: one generates the warmth, the other transmits it.",
    competitive: "Sitting on genuine interest without displaying it is like holding a winning hand and never placing the bet. The other person has no way to know you value them unless your face communicates that value. Chapter 4 built the asset. Chapter 5 deploys it. People who do the internal work but skip the visible signal are leaving their strongest card on the table unused."
  },
  // 5: "Small experiments prove the point fast."
  {
    gentle: "William Steinhardt was a New York stockbroker with no particular interest in self-improvement when he committed to smiling at every person he encountered for seven days. By the third day, his wife told him he seemed like a different person. Colleagues who had kept their distance began approaching him. A doorman he had walked past for years started greeting him by name. Steinhardt changed nothing about his life except his expression, and the results appeared faster than he expected.",
    direct: "Steinhardt's experiment lasted seven days and produced measurable changes by day three. His wife noticed a shift in his demeanor. Coworkers who had been professionally distant started initiating conversations. A building doorman who had barely acknowledged him began using his name. The only variable Steinhardt changed was his facial expression. The speed of the results suggests that most people's default expression is broadcasting a signal they never chose and never examined.",
    competitive: "The Steinhardt experiment is a low-cost proof of concept with a seventy-two-hour payoff window. Most objections to Carnegie's advice are theoretical. Steinhardt's data is empirical. He tested the claim, tracked the results, and the shifts were visible across every relationship in his life within half a week. The barrier to replicating his results is zero. The reason most people will not do it is the same reason it remains an uncrowded advantage."
  },
  // 6: "Your smile sets the other person's starting mood."
  {
    gentle: "When you walk into a room looking pleased to see someone, you are not just expressing how you feel. You are shaping how they feel. The other person's emotional starting point shifts toward warmth in response to yours, and that warmer starting point makes the entire conversation easier for both of you. Carnegie saw the smile as an environmental act, not just a personal one.",
    direct: "Your expression functions as an emotional primer for the other person. Neuroscience confirms that observing a genuine smile activates mirror-neuron responses that shift the observer's mood toward warmth before any conscious evaluation occurs. You are not passively displaying emotion. You are actively setting the conditions under which the other person will process everything you say next.",
    competitive: "The person who controls the emotional temperature of the opening moment controls the trajectory of the conversation. Walking in with visible warmth lowers the other person's guard involuntarily, giving you a receptive audience before you have said a single word. Walking in flat forces you to spend the first several minutes overcoming a defensive posture that your own expression created. The difference between these two openings compounds across every interaction in a week."
  }
];

// ── Hard moreDetails (9 takeaways) ──────────────────────────────

const hardMoreDetails = [
  // 1: "Your face delivers the first message."
  {
    gentle: "Carnegie chose Charles Schwab as his opening example because Schwab's advantage was entirely atmospheric. He managed one of the largest steel operations in the country against people with deeper technical expertise. What set Schwab apart was that people felt welcomed in his presence before he even began speaking. His smile arrived ahead of his pitch, and by the time the conversation started, the other person had already decided to be open. Your face carries a message that lands before your voice can intervene.",
    direct: "The brain processes facial expressions roughly 200 milliseconds before it begins processing speech. That gap means the other person's emotional response to your face is already forming while your first word is still in transit. A flat expression triggers a defensive posture. A genuine smile triggers receptivity. Schwab leveraged this timing advantage in every negotiation. By the time his competitors were starting their opening argument, Schwab had already shaped the room.",
    competitive: "Schwab competed against sharper technical minds and won because he controlled the signal that arrived first. His smile set the emotional conditions for every room he walked into. Most people forfeit this advantage without realizing it, entering conversations with a neutral expression that communicates nothing or communicates distance. The person who owns the first visual signal owns the opening of the conversation before anyone else has placed a word."
  },
  // 2: "Feeling follows action."
  {
    gentle: "William James offered a quiet but powerful reversal of common sense. Most people assume that emotions must come first and expressions follow. James showed that the relationship works both ways: the physical act of smiling sends a proprioceptive signal back to the brain that generates warmth. This means you are not at the mercy of your current mood. You can initiate the feeling you want by beginning with the physical action, and the internal state will follow at its own pace.",
    direct: "William James documented a feedback loop between facial muscle configuration and emotional processing. The act of smiling triggers a neurochemical cascade that shifts mood toward warmth. Carnegie cited James to address the most common resistance to the principle: people who say they cannot smile when they do not feel like it. James proved the sequence is reversible. The body leads and the brain adjusts. Waiting for the feeling first is an unnecessary delay.",
    competitive: "William James dismantled the idea that you need permission from your mood before you can act warm. The research shows the body can lead the brain. People who understand this generate their own emotional starting conditions instead of inheriting whatever state the morning handed them. That control is compounding: each smile produces warmth, which makes the next smile easier, which produces more warmth."
  },
  // 3: "A fake smile backfires."
  {
    gentle: "Carnegie draws a firm line between authentic warmth and a pasted-on grin, and the distinction matters more than it might seem. People read the difference below conscious awareness. A genuine smile involves the muscles around the eyes, and when those muscles stay still while the mouth moves, something registers as off. The result is less trust, not more. Getting this wrong is worse than not smiling at all, because you have added a layer of perceived dishonesty on top of neutrality.",
    direct: "A genuine smile activates both the zygomatic major and the orbicularis oculi. A performed smile typically activates only the zygomatic major. The observer's brain registers the mismatch and classifies it as a deception signal. Carnegie understood this separation intuitively. His instruction is not to perform warmth but to let real warmth become visible. If the internal warmth is absent, forcing the expression produces a net negative because it triggers suspicion rather than connection.",
    competitive: "The fake smile is a trap that catches people who treat Carnegie's advice as a surface technique. A performed grin costs you credibility because the mismatch between the mouth and the eyes is readable by almost everyone. The difficulty of producing a genuine smile is exactly what makes it a reliable trust signal. It cannot be cheaply reproduced, which means the person who invests the real internal work holds an advantage that no one running a technique can match."
  },
  // 4: "A smile makes your interest visible."
  {
    gentle: "You might genuinely value the person in front of you, but if your face does not communicate that value, they have no way to know it exists. Chapter 4 built the foundation of genuine interest in other people. This chapter provides the visible proof that the interest is real. Internal warmth that never reaches the surface benefits no one. A smile is how your regard crosses the gap between your inner experience and the other person's perception.",
    direct: "Chapter 4 and Chapter 5 operate as a pair. Chapter 4 generates genuine interest. Chapter 5 transmits it. Interest that stays in your head is indistinguishable from indifference to the person on the receiving end. They cannot access your internal state. They can only access your face. The smile converts a private feeling into a public signal, which is the only form the other person can process.",
    competitive: "Invisible interest produces zero return. The other person responds to what they can observe, not what you feel internally. Chapter 4 built the internal engine. Chapter 5 is the only way that engine reaches the outside world. People who do the hard internal work of genuine curiosity but fail to let it show on their face are carrying an asset they never cash in."
  },
  // 5: "The Steinhardt experiment is your proof of concept."
  {
    gentle: "Steinhardt was not a natural optimist or a charisma coach. He was a New York stockbroker who decided to test Carnegie's principle as a straightforward experiment: smile at every person for seven days and track what happens. By the third day, his wife told him he seemed like a different person. Colleagues who had been reserved for months started approaching him. A doorman who had barely acknowledged him began using his name. The only thing Steinhardt changed was his expression.",
    direct: "Steinhardt's seven-day experiment is the chapter's most direct piece of evidence. He changed one variable, his facial expression, and observed measurable shifts across his marriage, his workplace, and his daily interactions with strangers. Results appeared by day three. The experiment required no special skill, no personality change, and no financial investment. The speed of the results suggests most people's default expression is actively working against their social interests.",
    competitive: "Steinhardt's experiment is a seventy-two-hour proof of concept with zero capital requirement. He tested the claim empirically and got results across every category of relationship in his life before the week was half over. Anyone can dismiss Carnegie's advice as oversimplified. Steinhardt actually ran the test. The gap between theorizing and testing is where most people stall, which is precisely why the advantage remains available."
  },
  // 6: "You set the emotional temperature."
  {
    gentle: "When you enter a room with warmth on your face, the other person's emotional state begins shifting before they have time to think about it. You are not just expressing how you feel. You are quietly setting the conditions for how the interaction will unfold. Carnegie saw the smile as an act of emotional leadership: the person who arrives warm invites warmth in return, and that exchange shapes everything that follows.",
    direct: "Your expression acts as an emotional primer. Mirror-neuron responses cause the observer to begin mirroring your emotional state before conscious processing engages. A genuine smile primes warmth. A flat face primes caution. The conversation inherits whichever emotional baseline your face established in the first half-second. You are not reflecting conditions. You are generating them.",
    competitive: "First-mover advantage applies to emotional tone. The person who sets the temperature of the opening moment shapes the trajectory of the entire exchange. Walking in warm gives you a receptive audience before your first syllable lands. Walking in flat means you spend the first several minutes climbing out of a hole your own expression dug. The compounding difference across a full day of interactions is significant."
  },
  // 7: "A smile is the delivery system for every principle so far."
  {
    gentle: "Chapters 1 through 4 built a set of internal commitments: stop criticizing, give sincere appreciation, frame conversations around what the other person wants, and become genuinely interested. All of that work generates goodwill inside your head. But goodwill that stays inside your head never reaches anyone. A smile is the visible output that tells the other person all of those commitments are real. Without it, you are doing the internal work but sending no external proof.",
    direct: "The first four chapters build inputs: restraint from criticism, sincere appreciation, motive framing, and genuine interest. Chapter 5 is the output layer. Without visible warmth, every internal principle you have practiced remains invisible to the person in front of you. They cannot read your intentions. They can only read your face. The smile is what converts four chapters of internal discipline into a signal the other person can actually receive and respond to.",
    competitive: "Four chapters of internal work with no visible output is wasted leverage. You can avoid criticism, give appreciation, frame perfectly, and be genuinely interested, but if your face communicates nothing, the other person never receives any of it. The smile is the transmission layer. Skip it and every tool you have built sits idle while the other person responds to a blank expression that tells them nothing about your intentions."
  },
  // 8: "The misconception is that smiling means being fake."
  {
    gentle: "The most common resistance to this chapter comes from people who equate smiling with faking. Carnegie addresses this directly: the problem for most people is not that they feel too little warmth, but that they display too little of the warmth they already feel. There is a quiet gap between your internal state and your visible expression, and most people have never noticed it. Closing that gap is not performance. It is accuracy.",
    direct: "Most people's resting expression understates their actual internal warmth. The gap between what you feel and what your face shows is a communication error, not a personality trait. Carnegie is not asking you to add something artificial. He is asking you to correct a display problem that causes other people to misread your intentions on a regular basis. The fix is alignment between inside and outside, not fabrication.",
    competitive: "Your default expression is likely misrepresenting you to every person you meet. Most people feel more goodwill than their face broadcasts, which means the world is responding to a version of you that is colder than the real one. Correcting that misrepresentation is not about being fake. It is about stopping an unintentional signal from costing you trust and openness in every conversation you enter."
  },
  // 9: "The feedback loop is self-reinforcing."
  {
    gentle: "Once you smile and receive warmth in return, the next smile comes a little more naturally. Each positive exchange reduces the effort required and increases the return. Carnegie is describing a cycle that builds its own momentum over time. The first few smiles might feel deliberate, but within days the practice begins to sustain itself as the responses you receive make genuine warmth easier to access.",
    direct: "The sequence is: smile, receive warmth, feel warmth, smile with less effort. Each repetition lowers the activation cost and raises the return. Within a few days, the practice shifts from deliberate effort to reflexive behavior. Steinhardt reported this transition happening within his first week. The initial investment is conscious and slightly uncomfortable. The ongoing return is automatic and increasing.",
    competitive: "This principle operates on compound returns. Each positive exchange makes the next one easier, which makes the one after that easier still. People who start early build momentum that becomes self-sustaining within days. People who delay fall further behind because the gap between someone running the loop and someone who has not started widens with every interaction. The cost of waiting is not neutral. It is actively accumulating."
  }
];

// ── Apply moreDetails ──────────────────────────────

const mediumTakeaways = ch5.contentVariants.medium.keyTakeaways;
const hardTakeaways = ch5.contentVariants.hard.keyTakeaways;

if (mediumTakeaways.length !== mediumMoreDetails.length) {
  console.error(`Medium takeaway count mismatch: expected ${mediumMoreDetails.length}, got ${mediumTakeaways.length}`);
  process.exit(1);
}
if (hardTakeaways.length !== hardMoreDetails.length) {
  console.error(`Hard takeaway count mismatch: expected ${hardMoreDetails.length}, got ${hardTakeaways.length}`);
  process.exit(1);
}

for (let i = 0; i < mediumTakeaways.length; i++) {
  mediumTakeaways[i].moreDetails = mediumMoreDetails[i];
}

for (let i = 0; i < hardTakeaways.length; i++) {
  hardTakeaways[i].moreDetails = hardMoreDetails[i];
}

writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');

console.log(`Done. Added moreDetails to ${mediumMoreDetails.length} medium and ${hardMoreDetails.length} hard keyTakeaways in Chapter 5.`);
