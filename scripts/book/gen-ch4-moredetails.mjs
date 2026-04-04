import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath = join(__dirname, '../../book-packages/friends-and-influence.modern.json');

const data = JSON.parse(readFileSync(filePath, 'utf8'));
const ch4 = data.chapters[3];

// ============================================================
// MEDIUM keyTakeaways moreDetails (indices 0-5)
// ============================================================

const mediumMoreDetails = [
  // [0] Interest before technique (Thurston)
  {
    gentle: "Thurston repeated a silent phrase of affection for his audience before every show, not as showmanship but as emotional calibration. When he walked onstage, his attention was already oriented toward the people in the seats rather than toward his own performance. The warmth they felt was a byproduct of where his focus had been placed before the curtain rose.",
    direct: "Thurston's pre-show ritual rewired his attentional focus from self-monitoring to audience-monitoring, shifting his internal question from whether he was performing well to whether the audience was enjoying themselves. That shift changed his micro-expressions, pacing, and eye contact in ways no amount of rehearsal could replicate. Better magicians lost to him because they optimized the wrong variable.",
    competitive: "Thurston's competitors polished their sleight of hand while Thurston polished his orientation toward the crowd. Audiences left his shows feeling personally attended to, and that feeling drove repeat attendance. His edge was not in what his hands did but in where his attention went before a single card left the deck."
  },
  // [1] Prepare before you arrive (Roosevelt)
  {
    gentle: "Roosevelt would sit up past midnight reading about a visitor's area of expertise, whether it was cattle breeding or Caribbean poetry. By the time the person arrived, Roosevelt could ask questions that proved he had entered their world. That effort communicated something words alone never could: you were worth my time before you walked through this door.",
    direct: "Roosevelt's preparation habit converted surface-level meetings into trust-building events. When he asked a naturalist about a specific species or a diplomat about a regional dispute, the visitor recognized that Roosevelt had done real work. That recognition bypassed the slow process of earning trust through repeated contact and accelerated loyalty in a single conversation.",
    competitive: "While other politicians relied on charm during the meeting itself, Roosevelt front-loaded his advantage the night before. His specific, researched questions signaled a level of investment his competitors never matched. Visitors left feeling understood, and that feeling converted into political support faster than any policy argument could."
  },
  // [2] Genuine interest vs social performance
  {
    gentle: "Carnegie draws a quiet but firm line between asking because you care and asking because the moment calls for it. Performed curiosity sounds correct but lands hollow. The other person may not be able to name what feels off, but their willingness to open up stalls. Genuine curiosity, by contrast, produces follow-up questions that could not have been scripted.",
    direct: "The diagnostic is simple: genuine interest generates follow-up questions that respond to the specific answer given. Performed interest generates the same questions regardless of what the other person says. People register this difference quickly, often within two or three exchanges. Once they classify your attention as performed, recovering trust is significantly harder than earning it would have been.",
    competitive: "Performed interest is a depreciating asset. It works once, maybe twice, before the other person recalibrates and stops sharing anything meaningful. Genuine interest appreciates over time because each real question earns more detailed answers, which fuel even better questions. The gap between these two approaches widens with every interaction."
  },
  // [3] Interest builds the foundation for earlier chapters
  {
    gentle: "Appreciation without genuine attention behind it sounds like flattery. Framing conversations around the other person's interests without actually caring about those interests feels like a sales technique. Carnegie's earlier principles only breathe when they grow from real curiosity. Interest is what keeps the whole approach from collapsing into performance.",
    direct: "Chapter 2 says to give honest appreciation. Chapter 3 says to frame things in terms of the other person's wants. Both instructions assume you have accurate information about what the other person actually values. Without the genuine interest this chapter describes, you are guessing, and inaccurate appreciation or framing does more damage than saying nothing at all.",
    competitive: "Every principle in the earlier chapters borrows its credibility from this one. If your interest is thin, your appreciation sounds hollow and your framing looks calculated. Genuine interest is the supply chain that feeds accurate data into every other technique. Cut the supply chain and the entire operation stalls."
  },
  // [4] Flip from broadcasting to receiving
  {
    gentle: "Most conversations feel like two people taking turns broadcasting. Carnegie suggests something different: walk in planning to receive rather than to transmit. The shift feels vulnerable at first because you are giving up control of the conversation's direction. But what comes back is almost always richer than what you would have said.",
    direct: "Broadcasting is the default conversational mode because it feels productive: you are saying things, making points, filling silence. Receiving feels passive but produces better outcomes because the other person provides information you can use in every future interaction. Broadcasting produces one isolated impression while receiving produces compounding data.",
    competitive: "Broadcasters control the current conversation, but receivers control the relationship. When you shift to asking and absorbing, you accumulate knowledge about the other person that makes every subsequent meeting more precise. Broadcasters start from scratch each time while receivers build on everything they have already learned."
  },
  // [5] Two months vs two years
  {
    gentle: "Carnegie's claim that two months of interest outperforms two years of self-promotion is not motivational exaggeration. Each genuine conversation leaves a residue of trust that the next conversation builds on. Self-promotion, by contrast, creates isolated impressions that do not connect to each other. The compounding effect is what makes the timeline so dramatically different.",
    direct: "The two-month figure works because interest compounds across conversations. You learn something in meeting one, reference it in meeting two, and the other person feels a continuity of attention that deepens trust rapidly. Self-promotion does not compound because each new audience starts with no memory of your previous performance. The math favors the approach that stacks.",
    competitive: "Self-promotion is a linear strategy: each effort produces a fixed return. Interest is an exponential strategy: each conversation increases the value of the next one. Over two months, the person investing in genuine interest has built a network of people who feel personally known. Over two years, the self-promoter has a collection of forgettable first impressions."
  }
];

// ============================================================
// HARD keyTakeaways moreDetails (indices 0-8)
// ============================================================

const hardMoreDetails = [
  // [0] Thurston's backstage principle
  {
    gentle: "Thurston did not rely on positive thinking or surface affirmations. He engaged in a deliberate attentional practice before every performance, redirecting his focus from 'How will I look?' to 'How will they feel?' That internal shift changed his body language, his timing, and his eye contact in ways the audience registered without being able to articulate them.",
    direct: "Thurston's method was attentional redirection: before each show, he consciously moved his focus from self-evaluation to audience-evaluation. This changed measurable performance variables like eye contact duration, pause timing, and response to audience reactions. The audience experienced a performer who seemed to be with them rather than in front of them, and that perception gap is what separated his ticket sales from every competitor.",
    competitive: "Thurston found an asymmetric advantage: while rivals invested in better tricks, he invested in better orientation. The audience cannot tell the difference between a good trick and a great one, but they can absolutely tell the difference between a performer who cares about them and one who cares about applause. Thurston optimized for the variable that actually drove revenue."
  },
  // [1] Roosevelt's midnight research
  {
    gentle: "When Roosevelt stayed up reading about a visitor's specialty, he was not collecting conversation starters. He was entering the other person's world before they arrived. The questions he asked the next day carried a weight that small talk never could, because the visitor could hear that Roosevelt had already spent time inside their subject. That kind of preparation communicates respect in a way no greeting can.",
    direct: "Roosevelt's research habit produced a specific conversational advantage: he could ask questions that demonstrated comprehension rather than surface-level curiosity. A generic opener about someone's work signals politeness, but a specific reference to a policy vote in their district signals genuine investment. That level of specificity accelerates trust faster than any number of generic exchanges.",
    competitive: "Roosevelt turned preparation into a first-mover advantage. By the time a visitor sat down, Roosevelt already knew enough to ask questions that competitors would need three meetings to reach. The visitor's loyalty was effectively secured in the first five minutes because no one else had ever shown that level of prior engagement."
  },
  // [2] Genuine curiosity produces specific questions
  {
    gentle: "Carnegie's test is straightforward: listen to the questions you ask. If they could apply to anyone in the room, your interest has not yet engaged with the specific person in front of you. Genuine curiosity naturally produces questions tied to what you have just heard. When you find yourself defaulting to generic prompts, it is worth pausing to notice whether your attention has drifted.",
    direct: "Question specificity is a reliable proxy for interest depth, because a generic opener requires zero prior attention while a question referencing something the person said two minutes ago proves you were actually listening. The other person registers the difference instantly and adjusts their disclosure level accordingly. Specific questions unlock specific information, while generic questions keep the conversation permanently on the surface.",
    competitive: "Generic questions produce generic trust. Specific questions produce the perception that you have studied the other person's situation, even when you have only been listening carefully for a few minutes. That perception triggers a willingness to share information that surface-level conversationalists never access. The specificity of your questions directly controls the depth of information you receive."
  },
  // [3] Interest is the foundation for earlier principles
  {
    gentle: "Without genuine interest, the appreciation Carnegie describes in Chapter 2 starts to sound rehearsed. Without genuine interest, the perspective-taking in Chapter 3 feels like a calculated move. This chapter reveals that interest is not one technique among many. It is the condition that allows all the other techniques to land as sincere rather than strategic.",
    direct: "Chapters 2 and 3 require accurate data about what the other person values. Genuine interest is the data-collection process. Without it, appreciation targets the wrong things and framing misses the mark. When both chapters fire accurately, it is because the person applying them has done the invisible work of paying real attention first.",
    competitive: "This chapter is the supply line for Chapters 2 and 3. If your interest is genuine, your appreciation is accurate and your framing is targeted. If your interest is shallow, both tools misfire. The people who get the most out of Carnegie's earlier principles are the ones who take this chapter the most seriously, because accurate input produces precise output."
  },
  // [4] Switch from broadcast to receive mode
  {
    gentle: "The habit of planning what to say next is deeply ingrained, and Carnegie is not asking you to abandon it overnight. He is suggesting a gradual reorientation: entering conversations with the intention to learn rather than to impress. The discomfort of not having a planned statement ready fades quickly once you experience how much more freely people talk when they sense you are genuinely receiving.",
    direct: "Broadcasting and receiving produce different conversational data flows. When you broadcast, information moves in one direction and the other person has no reason to reveal anything beyond surface-level responses. When you receive, you create a vacuum that the other person fills with increasingly specific detail. The quality of your future interactions depends on which mode you default to now.",
    competitive: "Broadcasters optimize for impression per conversation while receivers optimize for information per conversation. Over ten meetings, the broadcaster has made ten separate impressions, but the receiver has built a detailed map of ten people's priorities, concerns, and preferences. That map is a compounding asset the broadcaster never accumulates."
  },
  // [5] Carnegie's two-month metric is structural
  {
    gentle: "The two-month claim is not about willpower or positive thinking. It describes a compounding process: you learn something genuine about a person, which sharpens your next question, which earns a deeper answer, which builds trust that carries into the following conversation. Each loop strengthens the next one. Self-promotion does not loop because the other person is not giving you anything to build on.",
    direct: "Interest compounds because it is a feedback loop: attention produces information, information produces better questions, better questions produce trust, and trust produces more information. Self-promotion is not a loop. It is a broadcast that resets with each new audience. The two-month timeline reflects how quickly a compounding process overtakes a linear one.",
    competitive: "Carnegie's two-month number is an efficiency claim, not an inspirational one. Compounding beats linear returns on any timeline, and two months is roughly the point where the gap becomes obvious. By then, the person who invested in genuine interest has deep relationships. The person who invested in self-promotion has a stack of business cards and no real leverage."
  },
  // [6] Interest is not submission (Roosevelt)
  {
    gentle: "Roosevelt was not softened by his attentiveness but strengthened by it. The loyalty he earned through genuine interest gave him a base of support that held firm when he made controversial decisions. His personal warmth and his political forcefulness were not in tension; they fed each other in a way his opponents consistently underestimated.",
    direct: "Roosevelt's case disproves the assumption that interest signals weakness. He combined the most aggressive policy agenda of his era with the most personally attentive leadership style. The personal loyalty he generated through genuine interest gave him political capital that pure authority could never produce. When he pushed controversial positions, the people he had listened to stayed with him.",
    competitive: "Roosevelt's opponents saw his warmth as softness and were wrong every time. His genuine interest in people generated a loyalty reserve that he could draw on when making aggressive moves. Leaders who rely on authority alone have power but not loyalty. Roosevelt had both, and the combination made him nearly impossible to outmaneuver."
  },
  // [7] Watch for the networking trap
  {
    gentle: "Carnegie is careful to distinguish between genuine interest and strategic relationship management. The difference is subtle but people feel it. When your attention has an agenda attached, even a quiet one, the other person senses that they are being processed rather than known. Genuine interest invests now and lets whatever comes back arrive on its own timeline.",
    direct: "Networking converts interest into a transaction: I learn about you so I can leverage the connection later. Genuine interest has no extraction timeline. The paradox is that the approach with no visible agenda produces better long-term returns, precisely because people share more openly when they do not feel managed. The moment your curiosity acquires a purpose beyond understanding, people recalibrate their openness.",
    competitive: "The networking trap is a self-defeating optimization. The more strategically you approach interest, the less the other person reveals, and the less valuable the relationship becomes. Genuine interest, which looks like the less efficient option, actually produces more actionable intelligence because people drop their guard completely when they sense no agenda."
  },
  // [8] The experience of being genuinely listened to is rare
  {
    gentle: "Most people spend their days in conversations where attention is partial at best. When someone encounters a person who listens without glancing at their phone, who asks a follow-up that proves they absorbed the previous answer, the experience is memorable precisely because it is uncommon. You do not need to be the most interesting person in the room. You need to be the most interested.",
    direct: "Genuine listening is scarce because it requires sustained attention with no immediate payoff. Most people default to half-listening while preparing their next contribution. The person who breaks that norm stands out not through effort or charisma but through contrast. In a room full of partial attention, full attention is a signal that registers immediately and is remembered long after.",
    competitive: "Scarcity drives value in attention the same way it drives value in markets. When full listening is rare, the person who provides it occupies a privileged position in the other person's memory. While everyone else competes to be heard, you gain an outsized advantage by competing to hear, because the supply of talkers is enormous and the supply of genuine listeners is not."
  }
];

// ============================================================
// Apply moreDetails to the chapter
// ============================================================

// Medium
const medKT = ch4.contentVariants.medium.keyTakeaways;
if (medKT.length !== mediumMoreDetails.length) {
  console.error(`Medium count mismatch: ${medKT.length} vs ${mediumMoreDetails.length}`);
  process.exit(1);
}
for (let i = 0; i < medKT.length; i++) {
  medKT[i].moreDetails = mediumMoreDetails[i];
}
console.log(`Applied moreDetails to ${medKT.length} medium keyTakeaways.`);

// Hard
const hardKT = ch4.contentVariants.hard.keyTakeaways;
if (hardKT.length !== hardMoreDetails.length) {
  console.error(`Hard count mismatch: ${hardKT.length} vs ${hardMoreDetails.length}`);
  process.exit(1);
}
for (let i = 0; i < hardKT.length; i++) {
  hardKT[i].moreDetails = hardMoreDetails[i];
}
console.log(`Applied moreDetails to ${hardKT.length} hard keyTakeaways.`);

// Write back
writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log('Wrote updated JSON back to', filePath);
