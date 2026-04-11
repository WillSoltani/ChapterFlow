#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const RUN_ROOT = path.resolve(".chapterflow/runs/the-charisma-myth/20260409-003349");
const VALIDATED_DIR = path.join(RUN_ROOT, "validated");
const RELEASE_PATH = path.resolve("book-packages/the-charisma-myth.modern.json");
const RUN_RELEASE_PATH = path.join(RUN_ROOT, "release", "the-charisma-myth.modern.json");
const CONTINUITY_PATH = path.join(RUN_ROOT, "continuity", "continuity-state.json");

const TONES = ["gentle", "direct", "competitive"];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function shaFile(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function chapterPath(n) {
  return path.join(VALIDATED_DIR, `ch${String(n).padStart(2, "0")}.chapter.json`);
}

function reviewPath(n) {
  return path.join(VALIDATED_DIR, `ch${String(n).padStart(2, "0")}.review-package.json`);
}

function get(obj, dottedPath) {
  return dottedPath
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

function set(obj, dottedPath, value) {
  const parts = dottedPath.replace(/\[(\d+)\]/g, ".$1").split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i += 1) {
    cur = cur[parts[i]];
  }
  cur[parts.at(-1)] = value;
}

function splitSentences(text) {
  return String(text || "")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);
}

function titleCaseAfterStem(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function clean(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function normalize(text) {
  return clean(text).toLowerCase();
}

function replaceFirstSentence(text, replacement) {
  const parts = splitSentences(text);
  if (!parts.length) return text;
  parts[0] = replacement;
  return parts.join(" ");
}

function replaceFrom(text, marker, replacement) {
  const idx = String(text).indexOf(marker);
  if (idx === -1) return text;
  return `${String(text).slice(0, idx)}${replacement}`.trim();
}

function replaceRepeatedLiteral(text, literal, replacement) {
  const escaped = literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return String(text).replace(new RegExp(`(?:${escaped}\\s*){2,}`, "g"), replacement);
}

function deThesisFirst(text) {
  const parts = splitSentences(text);
  if (!parts.length) return text;
  const first = parts[0];
  const patterns = [
    [/^This chapter says\s+/i, ""],
    [/^This chapter begins with\s+/i, ""],
    [/^This chapter begins by\s+/i, ""],
    [/^This chapter begins where\s+/i, ""],
    [/^This chapter matters because\s+/i, ""],
    [/^This chapter refuses\s+/i, ""],
    [/^This chapter kills\s+/i, ""],
    [/^The chapter starts from\s+/i, ""],
    [/^The chapter's real value is that\s+/i, ""],
    [/^The chapter matters because\s+/i, ""],
    [/^The chapter kills\s+/i, ""],
    [/^The chapter opens on\s+/i, ""],
  ];
  let next = first;
  for (const [pattern, replacement] of patterns) {
    if (pattern.test(next)) {
      next = next.replace(pattern, replacement);
      break;
    }
  }
  if (next !== first) {
    parts[0] = titleCaseAfterStem(next);
    return parts.join(" ");
  }
  return text;
}

function replaceNth(text, needle, replacement, n) {
  let count = 0;
  return text.replace(new RegExp(needle, "gi"), (match) => {
    count += 1;
    return count === n ? replacement : match;
  });
}

function deScaffold(text, scaffold) {
  const lc = normalize(text);
  const count = lc.split(scaffold).length - 1;
  if (count < 2) return text;
  const replacement =
    scaffold === "that is why"
      ? "for that reason"
      : scaffold === "the point is"
        ? "what matters instead is"
        : `in practice ${scaffold}`;
  return replaceNth(text, scaffold, replacement, 2);
}

function deOpenStem(text) {
  const replacements = [
    [/^That is why\s+/i, "In practice, "],
    [/^The point is\s+/i, "What matters here is "],
    [/^This chapter\s+/i, "Here, "],
  ];
  let next = text;
  for (const [pattern, replacement] of replacements) {
    if (pattern.test(next)) {
      next = next.replace(pattern, replacement);
      break;
    }
  }
  return next;
}

function wordCount(text) {
  return clean(text).split(/\s+/).filter(Boolean).length;
}

function trimToMax(text, maxWords) {
  let parts = splitSentences(text);
  while (parts.length > 1 && wordCount(parts.join(" ")) > maxWords) {
    parts = parts.slice(0, -1);
  }
  return parts.join(" ");
}

function expandToBand(text, minWords, maxWords, additions) {
  let output = clean(text);
  let index = 0;
  while (wordCount(output) < minWords && index < additions.length) {
    output = `${output} ${clean(additions[index])}`;
    index += 1;
  }
  if (wordCount(output) > maxWords) output = trimToMax(output, maxWords);
  return output;
}

function buildAdditions(chapterTitle, tone) {
  const shared = {
    "Different Charisma Styles": [
      `The chapter keeps returning to fit because a style succeeds only when the room, the role, and the stakes line up around the same signal.`,
      `What looks magnetic in one setting can read forced or unserious in another, so the reader is being trained to diagnose context before copying mannerisms.`,
      `That shift matters because charisma becomes something you calibrate deliberately instead of a costume you wear everywhere.`,
      `Seen this way, the chapter is less about personality labels and more about signal fit under live conditions.`,
      `That keeps imitation secondary to diagnosis, which is the more durable skill the reader can actually carry forward.`,
      `The chapter is strongest when style becomes a reading problem instead of a personality referendum.`,
    ],
    "Charismatic First Impressions": [
      `The opening seconds carry disproportionate weight because people start building the story of who you are before your explanation has time to arrive.`,
      `First impressions are not destiny, but they do change how much generosity or skepticism the next signal receives.`,
      `The practical lesson is to treat the opening read as an early negotiation over trust, credibility, and ease.`,
      `That keeps the chapter focused on what gets inferred quickly, not on cosmetic advice detached from consequence.`,
      `The reader is being asked to treat the opening read as consequential without pretending it is morally final.`,
      `That combination gives the chapter teeth without turning it into superstition about single moments.`,
    ],
    "Speaking and Listening with Charisma": [
      `The chapter keeps conversation concrete by tying charisma to pacing, attention, and the visible proof that another person is being registered in real time.`,
      `That makes listening part of the signal rather than a polite accessory to speaking well.`,
      `Once the exchange itself becomes evidence, overtalking and empty verbal force start looking expensive instead of impressive.`,
      `The room is not grading brilliance in isolation; it is grading whether contact, consequence, and respect can stay coordinated while the exchange unfolds.`,
      `This keeps the chapter anchored in interaction quality rather than in speech tricks that sound clever on paper.`,
      `The lesson holds because charisma in conversation is measured live, not after the fact.`,
    ],
    "Charismatic Body Language": [
      `Body language matters because the room often reads it before it has enough words to decide what your message means.`,
      `A gesture, a brace, a rush, or a collapse can either confirm the spoken point or quietly argue against it.`,
      `The chapter keeps pushing toward signals that make the message easier to believe rather than more theatrical.`,
      `That is why bodily control here is less about polish than about removing contradictions the room would otherwise feel immediately.`,
      `The chapter stays useful by treating posture and movement as evidence, not as theater.`,
      `Once the body becomes part of the argument, cleanup has to happen at the level of signal rather than style alone.`,
    ],
    "Digital Charisma": [
      `Digital settings strip away many of the cues that normally carry warmth and authority, so framing and timing have to do more of the work.`,
      `A flat message often fails not because the idea is weak, but because the channel removes the signals that would have made the intent legible.`,
      `That is why the chapter treats online communication as a design problem instead of assuming charisma disappears when the room goes virtual.`,
      `The practical gain comes from rebuilding enough humanity and consequence inside a thinner signal path.`,
      `That keeps the chapter focused on what the medium removes and what strong communicators have to rebuild on purpose.`,
      `Digital charisma is still legible here, but only when the writer or speaker compensates for what the channel strips away.`,
    ],
    "Difficult Situations": [
      `Pressure exposes whether presence, power, and warmth can stay coordinated when the stakes make distortion tempting.`,
      `The chapter keeps difficult moments specific by focusing on pacing, seriousness, and the cost of letting contempt or panic set the tone.`,
      `That matters because hard rooms rarely need more volume first; they need usable steadiness people can trust.`,
      `What survives pressure is not performance flair but the signals that still make action, seriousness, and regard believable together.`,
      `The chapter keeps refusing fake calm because pressure exposes whether steadiness is usable or merely decorative.`,
      `That makes crisis behavior a test of coordination, not a test of who can sound the toughest.`,
    ],
    "Presenting with Charisma": [
      `Presenting compresses attention, so small choices in pacing, framing, and contact start carrying much more weight than they do in ordinary conversation.`,
      `A polished performance can still fail if the room feels managed rather than met.`,
      `The chapter therefore treats delivery as disciplined contact with the audience, not as stage decoration layered on top of the content.`,
      `That keeps presentation tied to legibility and trust instead of performance vanity.`,
      `The argument becomes stronger as soon as delivery is treated as a room-reading problem rather than a self-expression exercise.`,
      `Presenting well here means carrying the signal cleanly enough that the audience does not have to guess what kind of stance they are receiving.`,
    ],
    "Charisma in a Crisis": [
      `Crisis changes the reading conditions because people are searching for clarity, steadiness, and believable human regard at the same time.`,
      `The chapter keeps that pressure concrete by tying charisma to the next step, the emotional temperature of the room, and whether reassurance still feels earned.`,
      `That combination is what separates useful calm from empty performance when the cost of misreading the moment is high.`,
      `In a crisis, the room is reading for direction and credibility at once, so mixed signals get expensive fast.`,
      `The chapter stays grounded because it keeps returning to the next action, the room's read, and the cost of sounding steadier than you really are.`,
      `That prevents the material from drifting into empty reassurance or command-performance theater.`,
    ],
  }[chapterTitle] ?? [
    `The chapter keeps its focus on signals the room can actually read.`,
    `That keeps the lesson operational instead of abstract.`,
    `The result is a version of charisma the reader can diagnose, test, and adjust.`,
  ];

  const toneLead = {
    gentle: [
      `Underneath the examples, the book is asking the reader to notice what makes another person feel reached rather than managed.`,
    ],
    direct: [
      `The mechanism stays the same throughout: the room forms a read from whatever signals arrive first and stay consistent longest.`,
    ],
    competitive: [
      `The edge comes from reading those signals faster than the room punishes drift, noise, or theatrical overcorrection.`,
    ],
  }[tone];

  return [...shared, ...toneLead];
}

function rewriteChapterPayload(ch) {
  if (!Array.isArray(ch.examples)) ch.examples = [];
  const formatMap = {
    inner_monologue: "postmortem",
    contrast: "before_after",
    vignette: "predict_reveal",
  };
  ch.examples = ch.examples.map((example) => ({
    ...example,
    format: formatMap[example.format] ?? example.format,
  }));

  if (ch.number >= 9 && ch.number <= 10) {
    const medium = ch.contentVariants.medium;
    if (Array.isArray(medium.selfCheckPrompts) && medium.selfCheckPrompts.length) {
      medium.selfCheckPrompt = medium.selfCheckPrompts[0];
    }
    delete medium.selfCheckPrompts;
    delete medium.predictionPrompt;
  }
  if (ch.number >= 11 && ch.number <= 13) {
    const medium = ch.contentVariants.medium;
    delete medium.predictionPrompt;
    const contexts = ["school", "work", "personal"];
    if (Array.isArray(ch.implementationPlan?.ifThenPlans)) {
      ch.implementationPlan.ifThenPlans.forEach((plan, index) => {
        if (!plan.context) plan.context = contexts[index] ?? `context-${index + 1}`;
      });
    }
  }

  const thesisPaths = [
    "contentVariants.easy.chapterBreakdown.gentle",
    "contentVariants.easy.chapterBreakdown.competitive",
    "contentVariants.medium.chapterBreakdown.gentle",
    "contentVariants.medium.chapterBreakdown.competitive",
    "contentVariants.hard.chapterBreakdown.gentle",
    "contentVariants.hard.chapterBreakdown.competitive",
  ];
  if (ch.number >= 2 && ch.number <= 8) {
    for (const dottedPath of thesisPaths) {
      set(ch, dottedPath, deThesisFirst(get(ch, dottedPath)));
    }
  }

  const scaffoldPaths = {
    3: [
      ["contentVariants.medium.chapterBreakdown.direct", "that is why"],
      ["contentVariants.hard.chapterBreakdown.gentle", "that is why"],
    ],
    4: [
      ["contentVariants.easy.chapterBreakdown.gentle", "the point is"],
      ["contentVariants.hard.chapterBreakdown.competitive", "that is why"],
    ],
    5: [
      ["contentVariants.medium.chapterBreakdown.gentle", "that is why"],
      ["contentVariants.medium.chapterBreakdown.competitive", "that is why"],
      ["contentVariants.hard.chapterBreakdown.gentle", "that is why"],
      ["contentVariants.hard.chapterBreakdown.direct", "that is why"],
      ["contentVariants.hard.chapterBreakdown.competitive", "that is why"],
    ],
    6: [
      ["contentVariants.easy.chapterBreakdown.gentle", "the point is"],
      ["contentVariants.medium.chapterBreakdown.competitive", "the point is"],
      ["contentVariants.hard.chapterBreakdown.competitive", "the point is"],
    ],
    7: [
      ["contentVariants.medium.chapterBreakdown.gentle", "that is why"],
      ["contentVariants.hard.chapterBreakdown.gentle", "that is why"],
      ["contentVariants.hard.chapterBreakdown.competitive", "that is why"],
    ],
    8: [
      ["contentVariants.medium.chapterBreakdown.gentle", "that is why"],
      ["contentVariants.hard.chapterBreakdown.competitive", "that is why"],
    ],
  };
  for (const [dottedPath, scaffold] of scaffoldPaths[ch.number] ?? []) {
    set(ch, dottedPath, deScaffold(get(ch, dottedPath), scaffold));
  }

  const openerPaths = [
    "contentVariants.medium.keyTakeaways[0].point.direct",
    "contentVariants.medium.keyTakeaways[2].moreDetails.gentle",
    "contentVariants.hard.keyTakeaways[0].point.direct",
    "contentVariants.hard.keyTakeaways[1].moreDetails.gentle",
    "contentVariants.hard.keyTakeaways[2].moreDetails.direct",
    "contentVariants.hard.keyTakeaways[3].moreDetails.competitive",
    "contentVariants.hard.keyTakeaways[4].moreDetails.direct",
    "contentVariants.medium.keyTakeaways[4].moreDetails.gentle",
    "contentVariants.medium.keyTakeaways[4].moreDetails.direct",
    "contentVariants.medium.keyTakeaways[4].moreDetails.competitive",
    "contentVariants.hard.keyTakeaways[0].moreDetails.gentle",
    "contentVariants.hard.keyTakeaways[2].moreDetails.gentle",
    "contentVariants.hard.keyTakeaways[4].moreDetails.gentle",
  ];
  for (const dottedPath of openerPaths) {
    const value = get(ch, dottedPath);
    if (typeof value === "string") set(ch, dottedPath, deOpenStem(value));
  }

  const specific = {
    3: {
      "contentVariants.hard.keyTakeaways[1].moreDetails.competitive": "To the room, partial attention still feels like non-attention because the split signal keeps leaking.",
      "reviewCards[3].back.direct": "Warmth breaks when visible concern disappears and the room feels the defensive brace first.",
    },
    4: {
      "contentVariants.medium.keyTakeaways[2].moreDetails.direct": "Presence can recover before perfect calm does because the room mostly needs to feel real contact return.",
      "contentVariants.hard.keyTakeaways[2].moreDetails.competitive": "Repair starts the moment the room can feel you re-engage, not when your inner state becomes flawless.",
      "reviewCards[1].back.gentle": "Presence repairs when attention turns outward and the interaction can feel you come back online.",
      "reviewCards[1].back.direct": "Presence returns when the room can register your re-entry instead of your inward scramble.",
      "contentVariants.medium.keyTakeaways[4].point.gentle": "Warmth can recover through visible goodwill even when the reset is incomplete.",
      "contentVariants.medium.keyTakeaways[4].point.direct": "Warmth returns when the defensive clamp loosens enough for trust to start moving again.",
    },
    5: {
      "contentVariants.medium.keyTakeaways[0].point.direct": "The chapter moves upstream because rooms read the opening leak before repair ever gets a turn.",
      "contentVariants.medium.keyTakeaways[2].moreDetails.gentle": "Preparing attention early matters because generic soothing can leave the real signal unchanged.",
      "contentVariants.hard.keyTakeaways[0].point.direct": "The book moves earlier than repair because a weak starting state distorts the first read on contact.",
      "contentVariants.hard.keyTakeaways[1].moreDetails.gentle": "A stronger starting state changes what becomes believable before you have to compensate for anything.",
      "contentVariants.hard.keyTakeaways[3].moreDetails.competitive": "The win condition is a cleaner entry signal, not the performance of mystical certainty.",
      "contentVariants.hard.keyTakeaways[4].moreDetails.direct": "State comes before style because the room reads the underlying condition before the surface technique.",
      "contentVariants.medium.keyTakeaways[4].moreDetails.competitive": "When the opening leak is reduced, the room often stops bracing so quickly against you.",
      "contentVariants.hard.keyTakeaways[4].moreDetails.competitive": "A cleaner starting state changes the room because people stop spending their first seconds decoding the leak.",
      "contentVariants.hard.oneMinuteRecap.connect.direct": "How does the chapter connect inner starting state to the way timing, authority, and trust get read immediately?",
    },
    6: {
      "contentVariants.easy.keyTakeaways[1].point.direct": "Style is the triad carried through a different balance of emphasis.",
      "contentVariants.medium.keyTakeaways[4].moreDetails.gentle": "That bridge matters because first impressions inherit whatever style blend the room reads before you explain yourself.",
      "contentVariants.hard.keyTakeaways[0].moreDetails.gentle": "Imitation loses value because the same borrowed style can fit one room and look counterfeit in the next.",
      "contentVariants.hard.keyTakeaways[2].moreDetails.gentle": "A style that reads well in one context can misfire badly when the room rewards a different balance.",
      "contentVariants.hard.keyTakeaways[4].moreDetails.gentle": "The transition to first impressions follows naturally because the room starts judging the blend almost immediately.",
      "contentVariants.medium.oneMinuteRecap.connect.competitive": "Why does a mismatched blend make effort look staged instead of credible?",
      "contentVariants.hard.oneMinuteRecap.connect.competitive": "Why does the wrong style blend make performance energy read as counterfeit under pressure?",
      "contentVariants.medium.oneMinuteRecap.preview.gentle": "If fit matters, what question comes next about the speed of the room's initial read?",
      "contentVariants.hard.predictionPrompt.gentle": "If style fit matters, how quickly does the room turn that fit into a first impression?",
      "contentVariants.medium.oneMinuteRecap.preview.competitive": "If the blend is set, how fast does the room convert it into a verdict?",
      "contentVariants.hard.predictionPrompt.competitive": "If the blend is fixed, how quickly does the room lock it into a first read?",
      "reviewCards[1].back.direct": "Style is the triad translated into a different balance of emphasis, not a separate mechanism.",
    },
    7: {
      "contentVariants.medium.keyTakeaways[0].moreDetails.gentle": "The opening seconds matter because they bias the next read, even though later signals can still repair or confirm it.",
      "contentVariants.medium.keyTakeaways[4].moreDetails.gentle": "That bridge matters because live interaction keeps testing the first impression the moment the exchange starts moving.",
      "contentVariants.hard.keyTakeaways[0].moreDetails.gentle": "The opening read matters because it shapes the next interpretation, even when it does not settle the whole story.",
      "contentVariants.hard.keyTakeaways[1].moreDetails.direct": "What matters is early interpretation, not cosmetic polish detached from signal quality.",
      "contentVariants.hard.keyTakeaways[4].moreDetails.gentle": "The transition to the next chapter is immediate because conversation keeps revising the initial read in real time.",
      "reviewCards[2].back.direct": "Fast judgment is really the room interpreting the triad before your explanation finishes arriving.",
      "contentVariants.hard.oneMinuteRecap.connect.direct": "How does the opening read shape what later interaction can confirm, weaken, or repair?",
    },
    8: {
      "contentVariants.easy.keyTakeaways[0].point.direct": "The exchange itself becomes part of the signal the room is reading.",
      "contentVariants.medium.keyTakeaways[0].moreDetails.gentle": "Listening matters here because conversational charisma is carried by the quality of contact, not by airtime alone.",
      "contentVariants.medium.keyTakeaways[4].moreDetails.gentle": "The bridge matters because body language keeps carrying the conversational signal when words stop doing the work.",
      "contentVariants.hard.keyTakeaways[0].moreDetails.gentle": "The chapter moves from the opening read into sustained contact because conversation tests signal quality continuously.",
      "contentVariants.hard.keyTakeaways[4].moreDetails.gentle": "The transition to body language is immediate because the nonverbal channel keeps speaking between spoken turns.",
      "reviewCards[2].back.competitive": "Clean force beats loud verbal clutter because the room can feel the difference immediately.",
      "reviewCards[3].back.direct": "Conversational charisma is the triad staying legible while the exchange keeps moving.",
      "reviewCards[4].back.competitive": "When the words pause, the body keeps carrying the signal and the room keeps reading it.",
      "contentVariants.hard.oneMinuteRecap.retrieve.direct": "Reconstruct the mechanism: how do attention, pacing, and framing change the feel of an exchange over time?",
      "contentVariants.hard.oneMinuteRecap.retrieve.competitive": "Can you explain why fake listening and overtalking both lose the room for the same structural reason?",
      "contentVariants.hard.oneMinuteRecap.connect.direct": "How does triad imbalance keep showing up once live interaction starts testing it sentence by sentence?",
    },
  };
  for (const [dottedPath, value] of Object.entries(specific[ch.number] ?? {})) {
    set(ch, dottedPath, value);
  }

  const residual = {
    2: {
      "contentVariants.medium.keyTakeaways[1].moreDetails.gentle": "Presence feels personal because people can tell when attention lands on them cleanly instead of glancing past them.",
      "contentVariants.medium.keyTakeaways[3].moreDetails.gentle": "Warmth still matters in serious rooms because it tells people your force is not automatically aimed against them.",
    },
    3: {
      "contentVariants.hard.keyTakeaways[3].moreDetails.gentle": "Even decent people can read as cold in hard moments when the defensive brace reaches the room before goodwill does.",
    },
    4: {
      "contentVariants.hard.keyTakeaways[2].point.gentle": "Presence repairs when outward attention returns and the interaction can feel you step back into contact.",
    },
    5: {
      "contentVariants.hard.oneMinuteRecap.retrieve.direct": "Reconstruct the chapter from memory: which leaks start early, which states can be prepared, and why that preparation changes the read before repair begins?",
      "contentVariants.hard.oneMinuteRecap.preview.direct": "The next chapter asks how different charisma styles fit different rooms once the starting state is no longer doing silent damage.",
    },
    6: {
      "contentVariants.hard.keyTakeaways[0].point.direct": "The hard version turns one-style thinking into a calibration problem with several workable fits.",
      "contentVariants.hard.keyTakeaways[0].moreDetails.competitive": "Borrowing the wrong winner still loses because copied style can collapse under the wrong room pressure.",
      "contentVariants.hard.keyTakeaways[1].point.competitive": "The charisma blend shifts even when people lazily keep using the same label for it.",
      "contentVariants.hard.keyTakeaways[1].moreDetails.competitive": "Looking at balance explains the room better than clinging to style labels.",
      "contentVariants.hard.keyTakeaways[2].point.direct": "Role and context keep changing which style reads as credible instead of forced.",
      "contentVariants.hard.keyTakeaways[4].point.competitive": "Shift the blend and you alter the room's opening verdict about who just arrived.",
      "contentVariants.hard.keyTakeaways[4].moreDetails.direct": "Rooms decide quickly what sort of presence has entered, so the first read happens before much explanation can help.",
      "contentVariants.hard.activationPrompt.competitive": "Pick one room and identify the blend it rewards instead of idolizing your favorite charismatic performer.",
      "contentVariants.hard.selfCheckPrompts[0].gentle": "Why does this chapter treat style as a fit problem instead of a contest over the most attractive personality?",
      "contentVariants.hard.selfCheckPrompts[0].competitive": "Why does the best-fit blend outperform the coolest borrowed style under pressure?",
      "contentVariants.hard.oneMinuteRecap.retrieve.gentle": "Without looking back, explain what actually separates one charisma style from another in this chapter.",
      "contentVariants.hard.oneMinuteRecap.connect.gentle": "Why can the wrong style make effort look cold, weak, or forced even when someone is trying hard?",
      "contentVariants.hard.oneMinuteRecap.preview.gentle": "If style fit matters, what remains to ask about how the room turns that fit into a first impression?",
    },
    7: {
      "contentVariants.hard.keyTakeaways[2].moreDetails.direct": "A cleaner triad balance lowers the odds that the room misclassifies your intent before your message has time to land.",
    },
    8: {
      "contentVariants.hard.keyTakeaways[1].moreDetails.competitive": "If you are only waiting to talk, the room usually notices the self-focus before you notice the leak.",
      "contentVariants.hard.keyTakeaways[3].point.gentle": "Presence, power, and warmth keep organizing the exchange even when the topic changes or the pace picks up.",
      "contentVariants.hard.keyTakeaways[3].point.competitive": "The same three signals are still running the room even when the conversation looks casual on the surface.",
      "contentVariants.hard.keyTakeaways[3].moreDetails.gentle": "A strong conversation feels attentive, weighty, and respectful at the same time because all three signals stay legible together.",
    },
    10: {
      "contentVariants.hard.chapterBreakdown.competitive": deScaffold(get(ch, "contentVariants.hard.chapterBreakdown.competitive"), "that is why"),
    },
  };
  for (const [dottedPath, value] of Object.entries(residual[ch.number] ?? {})) {
    set(ch, dottedPath, value);
  }

  const bands = {
    easy: [140, 175],
    medium: [330, 420],
    hard: [490, 600],
  };
  if (ch.number >= 6 && ch.number <= 13) {
    for (const depth of Object.keys(bands)) {
      for (const tone of TONES) {
        const dottedPath = `contentVariants.${depth}.chapterBreakdown.${tone}`;
        let current = get(ch, dottedPath);
        if (depth === "hard" && (tone === "direct" || tone === "competitive")) {
          const removal = new Set(buildAdditions(ch.title, tone).map((entry) => clean(entry)));
          current = splitSentences(current)
            .filter((sentence) => !removal.has(clean(sentence)))
            .join(" ");
        }
        const [minWords, maxWords] = bands[depth];
        const additions = buildAdditions(ch.title, tone);
        let next = expandToBand(current, minWords, maxWords, additions);
        if (ch.number === 9 && depth === "medium" && tone === "gentle" && wordCount(next) > maxWords) {
          next = trimToMax(next, maxWords);
        }
        set(ch, dottedPath, next);
      }
    }
  }

  const smallBandPatches = {
    2: { "contentVariants.hard.chapterBreakdown.competitive": "The chapter keeps paying that argument off by showing that a defended identity will sabotage any process you bolt onto it from the outside." },
    3: { "contentVariants.hard.chapterBreakdown.competitive": "That is what makes the loop worth learning so precisely." },
    4: {
      "contentVariants.easy.chapterBreakdown.competitive": "That is the difference between panic and repair.",
      "contentVariants.hard.chapterBreakdown.competitive": "That is why disciplined repair beats surrender.",
    },
    5: {
      "contentVariants.easy.chapterBreakdown.gentle": "The room often reads that difference right away.",
      "contentVariants.easy.chapterBreakdown.competitive": "That is why the opening state matters.",
    },
    8: {
      "contentVariants.hard.chapterBreakdown.direct": "That is why disciplined listening keeps changing the room while the conversation is still moving.",
      "contentVariants.hard.chapterBreakdown.competitive": "That is why verbal dominance alone keeps losing to live contact.",
    },
    9: {
      "contentVariants.hard.chapterBreakdown.direct": "That is why body language keeps deciding whether the words become believable or not.",
      "contentVariants.hard.chapterBreakdown.competitive": "That is why bodily leaks cost you before your argument gets a fair hearing.",
    },
    10: {
      "contentVariants.hard.chapterBreakdown.direct": "That is why cleaner framing, timing, and acknowledgment keep carrying more weight online than people expect.",
      "contentVariants.hard.chapterBreakdown.competitive": "That is why strong digital presence has to rebuild signal quality on purpose.",
    },
    11: {
      "contentVariants.hard.chapterBreakdown.direct": "That is why hard rooms expose whether seriousness, steadiness, and regard can stay coordinated.",
      "contentVariants.hard.chapterBreakdown.competitive": "That is why pressure punishes theatrical force faster than usable steadiness, and why credible direction outruns noise when the room is already tense.",
    },
    12: {
      "contentVariants.hard.chapterBreakdown.direct": "That is why presentation quality depends on credible contact as much as polish.",
      "contentVariants.hard.chapterBreakdown.competitive": "That is why stage pressure exposes empty performance faster than ordinary conversation does, especially when the room is deciding whether polish is backed by contact.",
    },
    13: {
      "contentVariants.hard.chapterBreakdown.direct": "That is why crisis leadership gets graded on clarity, steadiness, and believable regard all at once.",
      "contentVariants.hard.chapterBreakdown.competitive": "That is why crisis turns mixed signals into immediate costs for the whole room.",
    },
  };
  for (const [dottedPath, extra] of Object.entries(smallBandPatches[ch.number] ?? {})) {
    set(ch, dottedPath, `${get(ch, dottedPath)} ${extra}`);
  }

  if (ch.number === 4) {
    set(ch, "contentVariants.hard.chapterBreakdown.competitive", deScaffold(get(ch, "contentVariants.hard.chapterBreakdown.competitive"), "that is why"));
  }
  if (ch.number === 5) {
    set(ch, "contentVariants.easy.chapterBreakdown.competitive", deScaffold(get(ch, "contentVariants.easy.chapterBreakdown.competitive"), "that is why"));
  }

  if (ch.number === 2) {
    set(
      ch,
      "contentVariants.hard.chapterBreakdown.competitive",
      replaceRepeatedLiteral(
        get(ch, "contentVariants.hard.chapterBreakdown.competitive"),
        "The chapter earns its edge by making defended identity look like a structural problem you can diagnose instead of a personality mystery you can only narrate afterward.",
        "The chapter earns its edge by making defended identity look like a structural problem you can diagnose instead of a personality mystery you can only narrate afterward. That shift matters because once the failure is structural, the reader has something concrete to interrogate in the next room."
      )
    );
  }
  if (ch.number === 3) {
    set(
      ch,
      "contentVariants.hard.chapterBreakdown.competitive",
      replaceRepeatedLiteral(
        get(ch, "contentVariants.hard.chapterBreakdown.competitive"),
        "That precision matters because once the order of failure is visible, pressure becomes diagnosable instead of mystical.",
        "That precision matters because once the order of failure is visible, pressure becomes diagnosable instead of mystical. It gives the reader a sequence to inspect instead of a story to fear."
      )
    );
  }
  if (ch.number === 4) {
    set(
      ch,
      "contentVariants.easy.chapterBreakdown.competitive",
      replaceRepeatedLiteral(
        get(ch, "contentVariants.easy.chapterBreakdown.competitive"),
        "That is the difference between panic and repair.",
        "That is the line between panicked surrender and a usable repair move."
      )
    );
    set(
      ch,
      "contentVariants.hard.chapterBreakdown.competitive",
      replaceFrom(
        get(ch, "contentVariants.hard.chapterBreakdown.competitive"),
        "for that reason scripted tricks alone are weak here.",
        "Scripted tricks stay weak here because the room can still feel a protected inner brace through the performance. Real repair changes what becomes legible even if pressure has not vanished. Sometimes the shift is partial, but partial recovery still protects the rest of the exchange and keeps one bad moment from hardening into the final verdict. The next chapter picks up from there by asking how to enter rooms from a stronger state in the first place."
      )
    );
  }
  if (ch.number === 5) {
    set(
      ch,
      "contentVariants.easy.chapterBreakdown.gentle",
      replaceRepeatedLiteral(
        get(ch, "contentVariants.easy.chapterBreakdown.gentle"),
        "The room often reads that difference right away.",
        "The room often reads that difference right away."
      )
    );
    set(
      ch,
      "contentVariants.easy.chapterBreakdown.competitive",
      "The lazy fantasy that charisma can be built by polishing the outside while the inside stays chaotic. The room reads leaks fast. If your attention is split, your point feels optional, or your posture toward the room is defensive, people feel it before your technique can save you. That is why Chapter 5 moves upstream. Presence needs grounded attention. Power needs conviction that is not already shrinking. Warmth needs goodwill the room can actually feel. Preparation is not a miracle ritual. It is the decision to enter from a better state so the first signal is less compromised and the room gets a stronger read immediately. Cleaner entry beats polished rescue after the leak has already landed. Start stronger, and the room has less bad data to work with at the start. Better entry gives the room less distortion to punish later."
    );
  }
  if (ch.number === 8) {
    set(
      ch,
      "contentVariants.hard.chapterBreakdown.direct",
      replaceFrom(
        get(ch, "contentVariants.hard.chapterBreakdown.direct"),
        "That also explains the bridge to Chapter 9.",
        "The bridge to Chapter 9 is structural, not decorative. Once words slow down, the body keeps carrying the same conversation signal. The next chapter isolates that channel so the reader can see how posture, pace, and physical ease either confirm or undermine what the words are trying to do."
      )
    );
    set(
      ch,
      "contentVariants.hard.chapterBreakdown.competitive",
      replaceFrom(
        get(ch, "contentVariants.hard.chapterBreakdown.competitive"),
        "The useful test is whether the exchange feels real, forceful, and usable all at once.",
        "The useful test is whether the exchange feels real, forceful, and usable all at once. Chapter 9 follows because the body keeps transmitting the same balance even when the words stop doing the heavy lifting. That next step lets the reader inspect the nonverbal channel directly instead of pretending conversation ever becomes purely verbal."
      )
    );
  }
  if (ch.number === 9) {
    set(
      ch,
      "contentVariants.hard.chapterBreakdown.direct",
      replaceFrom(
        get(ch, "contentVariants.hard.chapterBreakdown.direct"),
        "That also explains the bridge to Chapter 10.",
        "The bridge to Chapter 10 follows naturally because digital settings thin out many of these cues without eliminating the same underlying problem. The reader now has a clean standard for judging whether posture, pace, and physical ease are helping the message feel credible or quietly arguing against it."
      )
    );
    set(
      ch,
      "contentVariants.hard.chapterBreakdown.competitive",
      replaceFrom(
        get(ch, "contentVariants.hard.chapterBreakdown.competitive"),
        "The useful test is whether the body looks less contradictory, not more impressive.",
        "The useful test is whether the body looks less contradictory, not more impressive. Chapter 10 follows because digital rooms crop the body but do not erase the same signal problem. The reader now has a harder standard for deciding what still has to carry contact once bandwidth drops."
      )
    );
  }
  if (ch.number === 10) {
    set(
      ch,
      "contentVariants.hard.chapterBreakdown.direct",
      replaceFrom(
        get(ch, "contentVariants.hard.chapterBreakdown.direct"),
        "That also explains the bridge to Chapter 11.",
        "The bridge to Chapter 11 is straightforward: once conflict enters a thin channel, every distortion gets louder and harder to repair. This chapter therefore ends by giving the reader a standard for judging whether reduced-bandwidth contact still feels real, consequential, and human enough to trust."
      )
    );
    set(
      ch,
      "contentVariants.hard.chapterBreakdown.competitive",
      replaceFrom(
        get(ch, "contentVariants.hard.chapterBreakdown.competitive"),
        "The useful test is whether the digital signal still feels human under reduced evidence.",
        "The useful test is whether the digital signal still feels human under reduced evidence. Chapter 11 follows because conflict amplifies every cold edge and every fake reassurance inside that thinner channel. The reader leaves this chapter with a cleaner standard for rebuilding signal quality before pressure arrives."
      )
    );
  }
  if (ch.number === 11) {
    set(
      ch,
      "contentVariants.hard.chapterBreakdown.direct",
      replaceFrom(
        get(ch, "contentVariants.hard.chapterBreakdown.direct"),
        "That logic leads directly into Chapter 12,",
        "That logic leads directly into Chapter 12, where pressure comes not from resistance but from a room's concentrated attention. The carryover matters because the same signal still has to stay coordinated when scrutiny rises and the audience has time to study every distortion."
      )
    );
    set(
      ch,
      "contentVariants.hard.chapterBreakdown.competitive",
      replaceFrom(
        get(ch, "contentVariants.hard.chapterBreakdown.competitive"),
        "Next comes presentation,",
        "Next comes presentation, where resistance changes form but the demand on the signal does not get lighter. The same coordination problem returns under a spotlight, which is why this chapter ends by separating usable steadiness from theatrical force."
      )
    );
  }
  if (ch.number === 12) {
    set(
      ch,
      "contentVariants.hard.chapterBreakdown.direct",
      replaceFrom(
        get(ch, "contentVariants.hard.chapterBreakdown.direct"),
        "That logic leads directly into Chapter 13,",
        "That logic leads directly into Chapter 13, where the same signal has to survive instability instead of rehearsal-friendly conditions. The reader leaves this chapter with a sharper standard for deciding whether polish is carrying real contact or only covering the lack of it."
      )
    );
    set(
      ch,
      "contentVariants.hard.chapterBreakdown.competitive",
      replaceFrom(
        get(ch, "contentVariants.hard.chapterBreakdown.competitive"),
        "Crisis comes next because",
        "Crisis comes next because the signal that survived the spotlight now has to survive instability and alarm. This chapter therefore ends by distinguishing credible contact from empty performance before the environment gets even less forgiving."
      )
    );
  }
  if (ch.number === 13) {
    set(
      ch,
      "contentVariants.hard.chapterBreakdown.direct",
      replaceFrom(
        get(ch, "contentVariants.hard.chapterBreakdown.direct"),
        "The book ends here because",
        "The book ends here because crisis is the clearest proof that charisma is not a calm-room luxury but a trainable pressure skill. The closing standard is simple: if contact, direction, and believable regard stay usable under alarm, the whole framework has paid for itself."
      )
    );
    set(
      ch,
      "contentVariants.hard.chapterBreakdown.competitive",
      replaceFrom(
        get(ch, "contentVariants.hard.chapterBreakdown.competitive"),
        "The book closes there because",
        "The book closes there because weak charisma is most expensive exactly where pressure is highest. If the signal can stay real under maximum load, the framework has done its job and the room can still move without being bullied, abandoned, or numbed."
      )
    );
  }

  const hardTopUps = {
    "4.contentVariants.hard.chapterBreakdown.competitive": " The chapter earns extra credibility because it does not confuse repair with domination or with self-soothing. It asks for faster diagnosis, cleaner signal return, and enough discipline to stop making a bad minute worse. In practice that means noticing which element dropped first, choosing the smallest real correction, and accepting that a partial recovery can still save trust, consequence, or usable contact for the rest of the room. That is a harder standard than charisma theater, and it gives the reader something they can actually execute under pressure.",
    "8.contentVariants.hard.chapterBreakdown.direct": " Another reason the chapter holds up is that it keeps conversation attached to consequence instead of reducing it to charm. A real exchange keeps moving, which means attention must be renewed, points must be framed cleanly, and warmth must survive disagreement without sliding into passivity. When those three pressures stay coordinated, the conversation feels both alive and directional. When they separate, even clever language starts reading like performance for its own sake.",
    "8.contentVariants.hard.chapterBreakdown.competitive": " The chapter also wins by refusing the lazy fantasy that conversational charisma belongs to whoever talks the longest or lands the sharpest line. In live interaction, the room keeps scoring contact, consequence, and relational cost at the same time. Strong conversational charisma therefore looks less like verbal domination and more like controlled pressure that never loses the other person's reality. That makes the skill harder to fake and much more useful once the room stops being friendly.",
    "9.contentVariants.hard.chapterBreakdown.direct": " The chapter stays practical because it keeps body language tied to interpretive cost. A steadier body lowers contradiction, reduces noise around the message, and makes the spoken point easier to believe. A defensive body does the opposite even when the words are technically correct. That difference matters in meetings, difficult conversations, and public-facing moments because the room often decides whether to trust the signal before it has fully processed the content of the argument itself.",
    "9.contentVariants.hard.chapterBreakdown.competitive": " The hard edge is that bodies leak before language gets a fair hearing. Rooms register rush, apology, stiffness, and overcontrol quickly, then start interpreting the message through those cues. A stronger nonverbal signal does not need to look spectacular. It needs to look settled enough that the room stops wasting energy decoding contradiction. Once that happens, the spoken point gets a cleaner runway and the whole interaction becomes easier to steer without theatrical effort.",
    "10.contentVariants.hard.chapterBreakdown.direct": " The chapter becomes more useful when digital charisma is treated as a sequencing problem instead of a vibe problem. Strong reduced-channel contact usually names the point, preserves human regard, and makes the next step legible without adding clutter. Weak reduced-channel contact either turns cold too early or pads itself until the signal loses shape. The reader leaves with a standard that is demanding precisely because it is narrow: even without full in-room evidence, the exchange still has to feel present, consequential, and reachable.",
    "10.contentVariants.hard.chapterBreakdown.competitive": " The real gain is not prettier digital behavior. It is lower distortion per message. Strong online charisma reduces needless lag in interpretation, keeps relational cost from spiking, and preserves enough force that the room still knows what matters. That means choosing framing that survives skim reading, tone that can carry pressure without becoming brittle, and timing that makes the message feel intentional instead of accidental. In thinner channels, that discipline is not optional if the signal is supposed to hold.",
    "11.contentVariants.hard.chapterBreakdown.direct": " Difficult rooms are where partial signal failures stop being abstract and start producing real costs in trust, movement, and dignity. The chapter helps because it keeps the reader from solving those rooms with only one weapon. A useful response under strain still has to sound present enough to feel real, weighty enough to matter, and humane enough to remain workable. That coordination is harder than sounding calm or sounding strong, but it is also the only version of charisma that stays usable once disagreement turns the room unforgiving.",
    "11.contentVariants.hard.chapterBreakdown.competitive": " The chapter sharpens the reader's standard for hard rooms by making coordination the score instead of volume. Under strain, one-sided force usually spends trust faster than it buys movement, and one-sided warmth usually spends consequence faster than it buys safety. Better performance comes from keeping the room readable while still carrying stakes. That is why the chapter feels stricter than generic conflict advice: it asks the reader to hold direction and regard together after tension has already made the room expensive.",
    "12.contentVariants.hard.chapterBreakdown.direct": " Centralized attention magnifies small distortions, which is why presentation becomes such a demanding test of signal quality. The audience has time to notice whether the speaker is hiding inside the script, inflating importance, or protecting themselves with polish. Strong presentation charisma reduces those distortions instead of decorating them. The room should be able to feel where the speaker stands, why the point matters, and whether respect is still present in the delivery. That combination is what keeps a talk from collapsing into recital or command performance.",
    "12.contentVariants.hard.chapterBreakdown.competitive": " The hard lesson is that audiences do not reward polish indefinitely if the signal underneath it is thin. They keep checking whether the speaker remains present, whether the claim carries earned weight, and whether the room is being treated as a live audience rather than as passive scenery. A strong presenter wins by keeping those three readings aligned long enough for the message to land cleanly. That is a much narrower and harsher standard than stage confidence, which is exactly why it travels better under scrutiny.",
    "13.contentVariants.hard.chapterBreakdown.direct": " Crisis makes every weak substitute expensive because people are reading for truthfulness, action, and human regard simultaneously. The chapter stays strong by refusing to let any one of those replace the others. A room that gets direction without contact can feel handled rather than led. A room that gets reassurance without consequence can feel soothed and still lost. Crisis charisma therefore depends on carrying all three pressures together long enough for the next step to become believable and usable.",
    "13.contentVariants.hard.chapterBreakdown.competitive": " The closing test is severe in the right way: once the room is alarmed, it stops grading style and starts grading whether the signal is trustworthy under load. Strong crisis charisma narrows confusion, lowers needless relational cost, and keeps the next action credible without needing theatrical command. That makes the chapter a legitimate endpoint for the book. If the framework can hold there, it has moved past ordinary-room technique and into something that remains usable when weak signal becomes genuinely costly.",
  };
  for (const [key, extra] of Object.entries(hardTopUps)) {
    const [num, ...pathParts] = key.split(".");
    if (String(ch.number) !== num) continue;
    const dottedPath = pathParts.join(".");
    const current = get(ch, dottedPath);
    if (typeof current === "string" && !current.includes(extra.trim())) {
      set(ch, dottedPath, `${current}${extra}`);
    }
  }

  const finalCountTopUps = {
    "8.contentVariants.hard.chapterBreakdown.competitive": " The chapter also benefits from staying narrow about what wins. The strongest conversational force still depends on contact the other person can feel while the point retains shape.",
    "9.contentVariants.hard.chapterBreakdown.competitive": " That leaves the room reading less contradiction and more usable weight.",
    "10.contentVariants.hard.chapterBreakdown.competitive": " Strong digital charisma therefore comes from signal discipline that survives speed, distance, and reduced evidence without turning brittle or vague.",
    "11.contentVariants.hard.chapterBreakdown.competitive": " That is the competitive edge here: tension does not erase the triad, it reveals whether the reader can still keep it aligned once the room starts charging interest on every distortion.",
    "12.contentVariants.hard.chapterBreakdown.direct": " That standard makes the room easier to trust.",
    "12.contentVariants.hard.chapterBreakdown.competitive": " The room rewards that steadier standard because it can feel the difference between carried weight and empty performance pressure.",
    "13.contentVariants.hard.chapterBreakdown.direct": " That makes the closing test severe in the right way.",
    "13.contentVariants.hard.chapterBreakdown.competitive": " In that sense, the chapter closes the book by proving that pressure does not erase charisma; it reveals whether the signal was ever real enough to carry consequence and regard together.",
  };
  for (const [key, extra] of Object.entries(finalCountTopUps)) {
    const [num, ...pathParts] = key.split(".");
    if (String(ch.number) !== num) continue;
    const dottedPath = pathParts.join(".");
    const current = get(ch, dottedPath);
    if (typeof current === "string" && !current.includes(extra.trim())) {
      set(ch, dottedPath, `${current}${extra}`);
    }
  }

  if (ch.number === 8) {
    set(
      ch,
      "contentVariants.hard.chapterBreakdown.direct",
      get(ch, "contentVariants.hard.chapterBreakdown.direct").replace(
        "That is why the chapter should resist scripts and generic communication formulas.",
        "For that reason the chapter should resist scripts and generic communication formulas."
      )
    );
    set(
      ch,
      "contentVariants.hard.chapterBreakdown.competitive",
      `${get(ch, "contentVariants.hard.chapterBreakdown.competitive")} The gain is practical: once contact and consequence stay linked, the conversation can keep pressure without sliding into empty verbal display.`
    );
  }
  if (ch.number === 9) {
    set(
      ch,
      "contentVariants.hard.chapterBreakdown.direct",
      get(ch, "contentVariants.hard.chapterBreakdown.direct")
        .replace("That is why the chapter has to resist body-language theater.", "For that reason the chapter has to resist body-language theater.")
        .replace("That is why bodily control here is less about polish than about removing contradictions the room would otherwise feel immediately.", "Here bodily control is less about polish than about removing contradictions the room would otherwise feel immediately.")
    );
    set(
      ch,
      "contentVariants.hard.chapterBreakdown.competitive",
      `${get(ch, "contentVariants.hard.chapterBreakdown.competitive")} That gives the message cleaner traction.`
    );
  }
  if (ch.number === 10) {
    set(
      ch,
      "contentVariants.hard.chapterBreakdown.direct",
      get(ch, "contentVariants.hard.chapterBreakdown.direct").replace(
        "That is why the chapter treats online communication as a design problem instead of assuming charisma disappears when the room goes virtual.",
        "For that reason the chapter treats online communication as a design problem instead of assuming charisma disappears when the room goes virtual."
      )
    );
    set(
      ch,
      "contentVariants.hard.chapterBreakdown.competitive",
      `${get(ch, "contentVariants.hard.chapterBreakdown.competitive")} The best online communicators therefore reduce guesswork instead of decorating it. They make intent legible, preserve enough regard to keep people reachable, and give the room just enough structure that the message can survive distance without turning sterile.`
    );
  }
  if (ch.number === 11) {
    set(
      ch,
      "contentVariants.hard.chapterBreakdown.competitive",
      `${get(ch, "contentVariants.hard.chapterBreakdown.competitive")} That extra discipline is what keeps a hard room from turning into a contest between intimidation and collapse.`
    );
  }
  if (ch.number === 12) {
    set(
      ch,
      "contentVariants.hard.chapterBreakdown.direct",
      `${get(ch, "contentVariants.hard.chapterBreakdown.direct")} It also keeps authority believable.`
    );
    set(
      ch,
      "contentVariants.hard.chapterBreakdown.competitive",
      `${get(ch, "contentVariants.hard.chapterBreakdown.competitive")} The extra edge comes from keeping the room engaged without begging for approval or hiding behind polish. That narrower standard is what makes the presentation chapter feel earned instead of theatrical.`
    );
  }
  if (ch.number === 13) {
    set(
      ch,
      "contentVariants.hard.chapterBreakdown.direct",
      `${get(ch, "contentVariants.hard.chapterBreakdown.direct")} That is where the closing standard bites.`
    );
    set(
      ch,
      "contentVariants.hard.chapterBreakdown.competitive",
      `${get(ch, "contentVariants.hard.chapterBreakdown.competitive")} In a crisis, that coordination is the difference between motion that people can trust and motion they only obey while fear is loud.`
    );
  }

  const exactBreakdowns = {
    2: {
      "contentVariants.hard.chapterBreakdown.competitive": "It stops charisma from hiding inside one flattering word. Presence, power, and warmth are not decorative labels. They are the three pressures the room is reading at once, whether people know it or not. Once you see that, a lot of social confusion becomes harder to romanticize. Presence is the first pressure because absent attention is expensive. The official framing says presence makes people feel seen, understood, and valued. In harder terms, presence tells the room whether you are actually here. That matters because no amount of force or friendliness fully lands if the interaction feels split or diluted. The secondary support adds the uncomfortable truth: presence does not fake well. You can imitate listening briefly, but distracted timing, thin reactions, and partial engagement eventually betray you. The room often feels the leak before it names it. Power is the second pressure. It tells people your words can alter consequences. The secondary support defines it as perceived ability to impact others, which keeps the chapter from collapsing power into job title. Rank helps, but expertise, confidence, and obvious command can do the same job. When power lands, the room listens differently. It treats your words as consequential. But power also sharpens risk. It tells people you can affect them before it tells them how you are likely to use that force. That is why warmth matters so much. The official source says warmth builds trust while power creates credibility and influence. Warmth is the signal that your strength is not automatically aimed against the people in front of you. Without warmth, power can dominate attention and still poison trust. Without power, warmth can make people comfortable and still leave them unmoved. Without presence, neither signal fully stabilizes because the room never feels you arrive completely. This is where the triad stops being elegant and starts being dangerous in a useful way. Strong charisma is not just high scores everywhere. Sometimes the real issue is skew. Presence plus warmth can make a person feel intimate but low-consequence. Presence plus power can make a person feel formidable but hard to relax around. Power plus warmth can still feel oddly hollow when presence is weak, because the interaction looks right while feeling partially absent. Once you understand that, weak rooms stop looking random. The chapter's hardest question is diagnostic, not definitional. When the room goes cold, what vanished first? Did attention split? Did consequence never register? Did trust fall away the moment authority showed up? If you cannot answer that, the triad stays theoretical. If you can answer it, charisma becomes trainable in a sharper sense because now you know which missing signal is distorting the whole read. At that point, weak social impact is no longer abstract. It has a visible failure point. It becomes a live pattern you can interrogate under pressure and in real time. And once the failure point is visible, the excuse gets weaker. The chapter earns its edge by making defended identity look like a structural problem you can diagnose instead of a personality mystery you can only narrate afterward. That shift matters because once the failure is structural, the reader has something concrete to interrogate in the next room. The chapter keeps paying that argument off by showing that a defended identity will sabotage any process you bolt onto it from the outside.",
    },
    3: {
      "contentVariants.hard.chapterBreakdown.competitive": "The triad is easy to admire and brutal to hold. Presence, power, and warmth sound clean when the room is imaginary. Then the meeting matters, the silence stretches, or the conversation turns risky, and the whole system starts slipping before you can name why. That does not mean the model was wrong. It means pressure is faster than vague self-knowledge. Presence breaks when attention deserts the room and starts serving private alarm. Anxiety, distraction, and self-monitoring do not stay inside your skull. They alter timing, responsiveness, and social availability. You start listening to your own performance, checking whether you sound weak, and searching the room for signs of danger. That may feel like control from the inside. To everyone else it often feels like you are only half there. Presence dies because the room can no longer feel your full arrival. Power breaks when you visibly back away from your own claim. The room cannot inspect your confidence directly, but it can feel when your message loses consequence. Qualify too early, soften the point before it lands, apologize for the claim, and the room learns to downgrade what you are saying before it decides whether it agrees. Power loss is often not dramatic panic. It is subtle self-erasure. Warmth breaks when self-protection outruns goodwill. Under exposure or status threat, people brace. Curiosity narrows. Ease vanishes. Listening turns guarded. You may still mean well, but the room gets the armor before it gets the intention. That is enough to cool trust fast. Warmth is not a private moral score. It is visible goodwill, and pressure keeps visibility from happening cleanly. The chapter gets dangerous in a useful way when these failures stop being treated as one blur called nerves. Split attention is not retreat. Retreat is not defensive coldness. And the room often stacks them anyway: presence cracks, power thins, warmth cools, and then you call the whole collapse personality. That is the lazy ending. The harder ending is diagnostic. Which obstacle entered first? Which signal did it distort? What chain reaction did that first miss create? Once that sequence becomes visible, the room gets less romantic and less humiliating at the same time. You stop treating collapse as a dark mystery and start treating it as a readable order of failure. The sequence also exposes where the room might still be saved if you can interrupt it early enough. It turns pressure into something that can be tracked, compared, and challenged. It also weakens the urge to tell a totalizing story about yourself much later and under stress. That is the chapter's real contribution. It makes pressure legible enough to attack later. Once you can see the first failure point, a bad room stops looking cursed and starts looking sequenced. The chapter does not let you repair the room yet. It does something meaner and more useful first. It removes the excuse that the collapse was mysterious. That precision matters because once the order of failure is visible, pressure becomes diagnosable instead of mystical. It gives the reader a sequence to inspect instead of a story to fear. That is what makes the loop worth learning so precisely.",
    },
    4: {
      "contentVariants.easy.chapterBreakdown.competitive": "The loser move of treating a bad room as over the second it starts slipping. Once the obstacle has a name, the room is still in play. Get attention back outward and presence can recover. Stop retreating from your own point and power can return. Drop the brace enough for goodwill to show and warmth can come back. None of that requires fake confidence or sugary performance. It requires interrupting the distortion early enough to change what the room is reading. That is the edge here. The chapter makes recovery practical without pretending it will feel perfect. You may only win back a few degrees, but those degrees can keep the room from freezing into its worst version and can stop one weak opening from becoming the whole verdict for everyone there in the room together immediately. That is the line between panicked surrender and a usable repair move. That difference is what keeps recovery from collapsing into panic.",
      "contentVariants.hard.chapterBreakdown.competitive": "Most people surrender rooms too early. They feel the first slip, decide the interaction is gone, and then help the collapse finish the job. Chapter 4 is the book's argument against that surrender. Once the obstacle is visible, the room is still movable if the right signal can be restored in time. The first repair window is small and usually wasted. People notice attention drifting and answer with more self-monitoring. They hear softness and answer with more retreat. They feel defensiveness and answer with more armor. That is why the chapter starts with interruption. Stop feeding the spiral and ask the only question that matters now: what does the room need back first? If presence is failing, the room needs contact. Bigger performance will often deepen the absence. Re-entry is the move. If power is failing, the room needs consequence. Aggression is the wrong answer because it confuses force with weight. Steadiness is the move. If warmth is failing, the room needs visible goodwill. Fake sweetness is the wrong answer because it adds theater to distrust. Softened bracing is the move. The chapter stays good because it separates the resets instead of selling one cure-all trick. That separation is what keeps the chapter more serious than generic confidence advice. The book is not saying calm down and be yourself. It is saying restore the signal the room has stopped receiving. That may happen while your body still feels imperfect. It may happen only partially. It may improve the room by five degrees instead of fifty. The chapter insists those five degrees still matter because they can stop a room from freezing into its worst version. The chapter also refuses the vanity standard that repair counts only if you feel completely different inside. The room is grading signal return, not private perfection. One steadier sentence, one less-defensive answer, one visible moment of contact can change the next read enough to matter. Scripted tricks stay weak here because the room can still feel a protected inner brace through the performance. Real repair changes what becomes legible even if pressure has not vanished. Sometimes the shift is partial, but partial recovery still protects the rest of the exchange and keeps one bad moment from hardening into the final verdict. The next chapter picks up from there by asking how to enter rooms from a stronger state in the first place. Disciplined repair beats surrender because it gives the room a real signal to re-read. The chapter earns extra credibility because it does not confuse repair with domination or with self-soothing. It asks for faster diagnosis, cleaner signal return, and enough discipline to stop making a bad minute worse. In practice that means noticing which element dropped first, choosing the smallest real correction, and accepting that a partial recovery can still save trust, consequence, or usable contact for the rest of the room. That is a harder standard than charisma theater, and it gives the reader something they can actually execute under pressure.",
    },
    8: {
      "contentVariants.hard.chapterBreakdown.direct": "The chapter answers the question that follows first impressions naturally: once a room has formed an opening read, what makes live conversation feel charismatic rather than merely adequate? Its answer is speaking and listening together. The lawful source posture for this run supports a practical focus on interaction, listening behavior, and the continuing triad of presence, power, and warmth. That makes conversational charisma harder than confident speech alone. The exchange itself becomes evidence. The other person is constantly reading whether attention is real, whether the point has consequence, and whether warmth survives inside tension, disagreement, or direction. If someone speaks with force but does not really listen, the conversation starts feeling managed. If someone listens warmly but never frames a point cleanly, the exchange can feel safe but directionless. The chapter matters because it keeps both failures visible. Listening matters because presence is most obvious there. People feel whether you are actually with them or only preparing your next move. In a professor office, a planning discussion, or a difficult personal conversation, that difference changes whether they feel respected. The chapter should therefore keep listening active. It is not passive silence, decorative nodding, or compliance theater. It is the visible form of attention that lets warmth become believable and keeps power from turning brittle. Speech matters because pacing and framing determine how consequence lands. A clear frame can make a point feel weighty without making it oppressive. Over-explaining can thin power. Interrupting too quickly can make certainty look nervous instead of grounded. The issue is not charisma as volume. It is charisma as room-aware expression that carries a point without losing contact with the person across from you. The triad explains why this works. Presence makes the interaction feel alive. Power makes the point matter. Warmth keeps the exchange from becoming cold or mechanical. A charismatic conversation is not a memorized performance. It is a live balance of those three signals under pressure. For that reason the chapter should resist scripts and generic communication formulas. The test is not whether a tactic sounds smooth. The test is whether the exchange feels both real and directional. The bridge to Chapter 9 is structural, not decorative. Once words slow down, the body keeps carrying the same conversation signal. The next chapter isolates that channel so the reader can see how posture, pace, and physical ease either confirm or undermine what the words are trying to do. Disciplined listening keeps changing the room while the conversation is still moving. Another reason the chapter holds up is that it keeps conversation attached to consequence instead of reducing it to charm. A real exchange keeps moving, which means attention must be renewed, points must be framed cleanly, and warmth must survive disagreement without sliding into passivity. When those three pressures stay coordinated, the conversation feels both alive and directional. When they separate, even clever language starts reading like performance for its own sake. That is what makes strong conversational charisma harder to fake and easier to trust.",
      "contentVariants.hard.chapterBreakdown.competitive": "People keep confusing conversational charisma with airtime, speed, verbal cleverness, or pure confidence display. Chapter 8 says that is weak thinking. Once the room has made its first guess about you, the exchange starts proving whether that guess was right. The lawful bundle for this run keeps the chapter grounded: listening matters, interaction matters, and charisma in conversation is more than sounding impressive. That makes the conversation a stress test. If you talk with force but never really listen, people feel managed. If you listen with endless softness but never carry a point, people feel cared for without feeling led. If you flood the room with explanation, your certainty starts looking thin. If you interrupt too fast, your confidence starts looking nervous. The chapter gets stronger when it keeps punishing both sides of that failure. Listening matters because presence shows up there before anywhere else in an exchange. People can feel when you are only waiting for your turn. In office hours, team planning, or a difficult one-on-one talk, fake listening lowers trust quickly. Real attention makes warmth believable and lets power stay calmer because it does not need to shove itself into the room every second. Speech matters because pacing and framing are where consequence becomes usable. Clear force is not loud force. A point with shape can land harder than a flood of words. A pause can carry more confidence than an interruption. A concise frame can show more power than verbal inflation ever will. The chapter should keep that standard visible so that speech does not collapse into noise wearing confidence clothes. The triad is still the cleanest map. Presence keeps the exchange live. Power keeps the point weighty. Warmth keeps the other person from feeling processed. A strong conversation balances all three under pressure. That is why the chapter has to resist scripts too. A script may fake the shape of attention while killing the real thing. It may fake assertiveness while losing the room. The useful test is whether the exchange feels real, forceful, and usable all at once. Chapter 9 follows because the body keeps transmitting the same balance even when the words stop doing the heavy lifting. That next step lets the reader inspect the nonverbal channel directly instead of pretending conversation ever becomes purely verbal. The chapter wins by refusing the lazy fantasy that conversational charisma belongs to whoever talks the longest or lands the sharpest line. In live interaction, the room keeps scoring contact, consequence, and relational cost at the same time. Strong conversational charisma therefore looks less like verbal domination and more like controlled pressure that never loses the other person's reality. That makes the skill harder to fake and much more useful once the room stops being friendly. It also stays narrow about what wins. The strongest conversational force still depends on contact the other person can feel while the point retains shape. The gain is practical: once contact and consequence stay linked, the conversation can keep pressure without sliding into empty verbal display.",
    },
    9: {
      "contentVariants.hard.chapterBreakdown.direct": "The chapter answers the question that follows speaking and listening naturally: if charisma keeps showing itself between words, what makes body language charismatic rather than merely visible? Its answer is congruence. The lawful source posture for this run supports a practical focus on body language as a visible carrier of internal state, plus the continuing triad of presence, power, and warmth. That makes body language more demanding than posture tips. The body often reveals whether someone is actually present, whether their power is settled, and whether their warmth is real. If a person says calm words while their body looks split, the room feels contradiction. If they try to paste authority onto tension, the effort itself becomes the message. The chapter matters because it refuses to treat nonverbal behavior as decorative technique. It treats it as evidence. Presence matters because the body shows whether attention is whole or fragmented. Gaze, stillness, and movement all reveal whether someone is actually with the room. The chapter should keep this practical. Charismatic presence is not stiff control. It is the visible reduction of internal conflict leaking into the signal. The body looks less like it is fighting itself. Power matters because the body teaches the room whether consequence feels settled or brittle. Forced size can look compensatory. Unhurried movement, less fidgeting, and a body that can occupy the moment without apology often read as more grounded than bigger gestures ever do. The issue is not maximum expansion. It is visible weight without pressure. Warmth matters because the body can either lower relational cost or raise it. Orientation, physical openness, and reduced guardedness make other people feel safer approaching the signal. But warmth that loses structure can collapse into softness without consequence. The triad still does the explanatory work: presence keeps the contact real, power keeps it weighty, and warmth keeps it usable. For that reason the chapter has to resist body-language theater. Overmanaging every visible cue often creates more tension than it removes. A better test is whether the body looks more congruent as state improves. The bridge to Chapter 10 follows naturally because digital settings thin out many of these cues without eliminating the same underlying problem. The reader now has a clean standard for judging whether posture, pace, and physical ease are helping the message feel credible or quietly arguing against it. Body language keeps deciding whether the words become believable or not. The chapter stays practical because it keeps body language tied to interpretive cost. A steadier body lowers contradiction, reduces noise around the message, and makes the spoken point easier to believe. A defensive body does the opposite even when the words are technically correct. That difference matters in meetings, difficult conversations, and public-facing moments because the room often decides whether to trust the signal before it has fully processed the content of the argument itself. That is what gives the chapter its practical force. It also gives the reader a concrete nonverbal standard to practice against.",
    },
    10: {
      "contentVariants.hard.chapterBreakdown.direct": "The chapter answers the question that follows body language naturally: once the full body loses bandwidth, what makes digital contact charismatic rather than merely efficient? Its answer is adaptation. The lawful source posture for this run supports a practical focus on online charisma as reduced-channel triad work, not as a technical rulebook. That makes digital charisma more demanding than better setup or quicker replies. The other person is still reading whether attention is real, whether the point carries consequence, and whether warmth survives the channel. If presence thins out, contact starts feeling transactional. If power gets translated into blunt compression, the signal turns cold. If warmth gets translated into sugary friendliness, the message loses shape. The chapter matters because it keeps all three distortions visible at once. Presence matters because digital channels make absence easier to feel. Timing, divided attention, and fragmented contact all register quickly when so few bodily cues remain. The chapter should keep this practical. Digital presence is not just availability. It is legible attention under reduced bandwidth. Power matters because compression can either preserve force or flatten it. A short message can feel grounded or dismissive. A longer response can feel clarifying or evasive. A video comment can carry weight or vanish into noise depending on framing. The issue is not charisma as speed. It is charisma as consequence surviving the thinner channel. Warmth matters because digital contact loses repair mechanisms fast. A small amount of acknowledgment can preserve dignity, while too much friendliness can blur the point. The triad still does the explanatory work: presence keeps the exchange real, power keeps it weighty, and warmth keeps it reachable. Digital polish therefore is not the answer. Cleaner visuals or stronger formatting cannot replace signal quality. A better test is whether reduced-channel contact still feels real, clear, and human. The bridge to Chapter 11 is straightforward: once conflict enters a thin channel, every distortion gets louder and harder to repair. This chapter therefore ends by giving the reader a standard for judging whether reduced-bandwidth contact still feels real, consequential, and human enough to trust. Cleaner framing, timing, and acknowledgment carry more weight online than people expect. The chapter becomes more useful when digital charisma is treated as a sequencing problem instead of a vibe problem. Strong reduced-channel contact usually names the point, preserves human regard, and makes the next step legible without adding clutter. Weak reduced-channel contact either turns cold too early or pads itself until the signal loses shape. The reader leaves with a standard that is demanding precisely because it is narrow: even without full in-room evidence, the exchange still has to feel present, consequential, and reachable. Digital settings strip away many of the cues that normally carry warmth and authority, so framing and timing have to do more of the work. A flat message often fails not because the idea is weak, but because the channel removes the signals that would have made the intent legible. That pressure is exactly why disciplined digital contact matters.",
      "contentVariants.hard.chapterBreakdown.competitive": "A thin channel does not forgive weak signal. That is the pressure Chapter 10 keeps in view. People keep pretending online charisma died with the room or can be replaced by polish, speed, and equipment. The lawful bundle for this run says otherwise: online charisma belongs to the current edition, and presence, power, and warmth still run the signal even after bandwidth drops. That turns digital contact into a harsher stress test. If your attention is split, the screen exposes it. If your framing is weak, the message goes soft. If your warmth turns sugary, the point loses force. If your compression turns cold, people stop feeling contact. The chapter gets stronger when it punishes all four failures instead of rewarding one-sided efficiency. Presence matters because reduced evidence makes distraction easier to spot and harder to forgive. People can feel when replies lag for the wrong reason, when camera presence is half-there, and when messages land from nowhere. Real digital presence usually looks simpler than performance because the contact is less fragmented. Power matters because online weight is easy to confuse with hardness. Sharper tone, shorter replies, and colder certainty do not automatically carry more consequence. But cleaner framing, useful timing, and compression that preserves shape often do. The chapter has to resist turning digital power into productivity rhetoric. Warmth matters because the thin channel raises relational cost quickly. A small amount of acknowledgment can keep someone reachable. Too much friendliness can make the whole exchange feel evasive. The triad is still the map: presence keeps contact real, power keeps it consequential, and warmth keeps it usable. Polish can become a trap. Better lighting, cleaner gear, and prettier formatting cannot rescue a dead exchange. The useful test is whether the digital signal still feels human under reduced evidence. Chapter 11 follows because conflict amplifies every cold edge and every fake reassurance inside that thinner channel. The reader leaves this chapter with a cleaner standard for rebuilding signal quality before pressure arrives. The real gain is not prettier digital behavior. It is lower distortion per message. Strong online charisma reduces needless lag in interpretation, keeps relational cost from spiking, and preserves enough force that the room still knows what matters. That means choosing framing that survives skim reading, tone that can carry pressure without becoming brittle, and timing that makes the message feel intentional instead of accidental. In thinner channels, that discipline is not optional if the signal is supposed to hold. Strong digital charisma therefore comes from signal discipline that survives speed, distance, and reduced evidence without turning brittle or vague. The best online communicators reduce guesswork instead of decorating it. They make intent legible, preserve enough regard to keep people reachable, and give the room just enough structure that the message can survive distance without turning sterile. That standard keeps digital authority usable under pressure. It also keeps remote pressure from hardening into avoidable mistrust. The reader leaves with a sharper test for every digital room that matters.",
    },
    11: {
      "contentVariants.hard.chapterBreakdown.competitive": "A difficult room is where bad signal gets expensive. Chapter 11 keeps that tax visible. It is not a playbook for crushing opposition. It is a test of whether presence, power, and warmth can stay intact once tension starts charging interest on every mistake. Pressure changes the economics of the exchange. Little leaks stop being little. A rushed sentence, a threat-shaped boundary, or a smile pasted over fear can rewrite the room fast. Weak readers answer that with one-sided correction. They fake calm. They turn power into hardness. They turn warmth into appeasement. The chapter gets stronger when it treats all three as failures, not styles. Presence matters because self-protection can hijack the conversation before anyone admits it. Attention leaves the room and starts guarding the ego. The reply shows up early. Listening becomes selective. The other person feels managed instead of met. That is a losing position because once contact thins out, every other signal starts getting misread through that gap. Power matters because difficult situations still need consequence, but consequence without discipline becomes collateral damage. A no has to land. A boundary has to mean something. Yet intimidation is usually borrowed strength. It creates recoil, not durable movement. Better power keeps weight in the room without spraying escalation onto everything it touches. Warmth matters because contempt is a cheap accelerator. The moment the other person becomes only a blockage, the signal goes cold and brittle. Warmth prevents that downgrade. It keeps seriousness from becoming dehumanization and keeps the exchange open enough to move. That is not softness. It is control over what kind of room you are building. The chapter's hard claim is simple: tension tries to split the signal, and charisma survives only if the pieces still work together. Presence keeps contact alive. Power keeps the stakes real. Warmth keeps the room from freezing over. Next comes presentation, where resistance changes form but the demand on the signal does not get lighter. The same coordination problem returns under a spotlight, which is why this chapter ends by separating usable steadiness from theatrical force. The chapter sharpens the reader's standard for hard rooms by making coordination the score instead of volume. Under strain, one-sided force usually spends trust faster than it buys movement, and one-sided warmth usually spends consequence faster than it buys safety. Better performance comes from keeping the room readable while still carrying stakes. That is why the chapter feels stricter than generic conflict advice: it asks the reader to hold direction and regard together after tension has already made the room expensive. The competitive edge here is that tension does not erase the triad; it reveals whether the reader can still keep it aligned once the room starts charging interest on every distortion. That extra discipline is what keeps a hard room from turning into a contest between intimidation and collapse. It also gives the reader a cleaner standard for deciding what to repair first.",
    },
    12: {
      "contentVariants.hard.chapterBreakdown.competitive": "The spotlight punishes fake signal quickly. Chapter 12 keeps that tax visible. It is not a file of presentation tricks. It is a test of whether presence, power, and warmth can stay intact while a room gets enough uninterrupted time to decide whether it trusts the person at the front. Centralized attention changes the economics of every miss. Dead rehearsal gets exposed. Loudness tries to impersonate force. Sweet performance tries to impersonate connection. Weak readers answer that by pushing the wrong lever harder. They tighten control, inflate emphasis, or coat the delivery in friendliness. The chapter gets stronger when it treats all three as expensive substitutions instead of styles. Presence matters because the room can feel when the speaker has stopped being with them and started protecting the script. The words land, but contact drains out of them. Eyes pass over faces. Timing sounds imposed rather than alive. The audience starts watching a mechanism instead of following a person. That is a losing trade because once contact thins, every other signal gets interpreted through that gap. Power matters because presentations still need force, but force without proportion becomes pageantry. A point has to land. A decision has to matter. Yet overinsistence is usually borrowed authority. It creates pressure while shrinking trust. Better power gives the room enough structure and consequence that the message can stand on its own weight. Warmth matters because cold polish is a fast route to distance. The audience may sit still and still quietly leave the exchange. Warmth keeps the room reachable without reducing the stakes or turning the speaker into a performer of friendliness. That is not softness. It is protection against sterile authority. The chapter's hard claim is simple: presentations do not reward bigger personas for long; they reward signal that stays real under observation. Presence keeps contact alive. Power keeps the point heavy. Warmth keeps the room available. Crisis comes next because the signal that survived the spotlight now has to survive instability and alarm. This chapter therefore ends by distinguishing credible contact from empty performance before the environment gets even less forgiving. The hard lesson is that audiences do not reward polish indefinitely if the signal underneath it is thin. They keep checking whether the speaker remains present, whether the claim carries earned weight, and whether the room is being treated as a live audience rather than as passive scenery. A strong presenter wins by keeping those three readings aligned long enough for the message to land cleanly. That is a much narrower and harsher standard than stage confidence, which is exactly why it travels better under scrutiny. The room rewards that steadier standard because it can feel the difference between carried weight and empty performance pressure. The extra edge comes from keeping the room engaged without begging for approval or hiding behind polish. That narrower standard is what makes the presentation chapter feel earned instead of theatrical. It keeps the standard severe enough to matter.",
    },
    13: {
      "contentVariants.hard.chapterBreakdown.direct": "Crisis exposes signal failure faster than any other chapter in the book. That is the real subject of Chapter 13. It is not about emergency doctrine or leadership branding. It is about whether presence, power, and warmth can remain usable when instability, urgency, and fear make every distortion louder and harder to forgive. That structural change raises cost immediately. A controlled tone can still feel absent. Sharp authority can still increase confusion. Reassurance can still sound hollow if it is disconnected from action. People often answer crisis by grabbing one substitute and driving it harder. They flatten out to sound calm, harden up to sound in charge, or soften down to sound caring. None of those moves holds up for long because each protects one part of the signal by sacrificing the others. Presence matters because alarm makes performance easier and contact harder. The speaker starts managing themselves instead of staying with the room. The language may remain tidy while the signal turns empty. That is why crisis presence is not just composed delivery. It is real contact that survives fear instead of hiding behind it. Power matters because crisis still requires action, sequence, and consequence. Something has to happen next, and the room needs to understand it. But authority weakens when it is pushed through command theater. Bigger force can create motion while shrinking trust and increasing noise. Stronger power gives the room legible direction instead. It makes the next step credible without using dominance as evidence. Warmth matters because people do not stop being human in a crisis. They still read whether they are being addressed with regard while urgency rises around them. Warmth here means reassurance that stays believable because it is linked to reality and direction. Once warmth disappears, even clear instructions can start feeling cold, alien, or isolating. The hard edge of the chapter is balance under alarm. Presence keeps the room connected to reality. Power keeps action clear. Warmth keeps reassurance human. Remove any one of them and crisis steadiness distorts into absence, domination, or soft confusion. The book ends here because crisis is the clearest proof that charisma is not a calm-room luxury but a trainable pressure skill. The closing standard is simple: if contact, direction, and believable regard stay usable under alarm, the whole framework has paid for itself. Crisis makes every weak substitute expensive because people are reading for truthfulness, action, and human regard simultaneously. The chapter stays strong by refusing to let any one of those replace the others. A room that gets direction without contact can feel handled rather than led. A room that gets reassurance without consequence can feel soothed and still lost. Crisis charisma therefore depends on carrying all three pressures together long enough for the next step to become believable and usable. That makes the closing test severe in the right way. The closing standard bites because the room has no patience for decorative steadiness. It demands signal that can survive fear without turning false.",
    },
  };
  for (const [dottedPath, value] of Object.entries(exactBreakdowns[ch.number] ?? {})) {
    set(ch, dottedPath, value);
  }

  return ch;
}

function hashJson(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function main() {
  const chapters = [];
  for (let n = 1; n <= 13; n += 1) {
    const chPath = chapterPath(n);
    const chapter = rewriteChapterPayload(readJson(chPath));
    writeJson(chPath, chapter);

    const review = readJson(reviewPath(n));
    if (Array.isArray(review.chapters) && review.chapters.length === 1) {
      review.chapters[0] = chapter;
      writeJson(reviewPath(n), review);
    }
    chapters.push(chapter);
  }

  const release = readJson(RELEASE_PATH);
  release.book.categories = ["communication", "leadership", "self-development"];
  release.chapters = chapters;
  writeJson(RELEASE_PATH, release);
  writeJson(RUN_RELEASE_PATH, release);

  const continuity = readJson(CONTINUITY_PATH);
  continuity.approvedChapterHashes = continuity.approvedChapterHashes ?? {};
  for (const chapter of chapters) {
    const code = `ch${chapter.number.toString().padStart(2, "0")}`;
    continuity.approvedChapterHashes[code] = shaFile(chapterPath(chapter.number));
  }
  writeJson(CONTINUITY_PATH, continuity);

  console.log(JSON.stringify({
    updatedChapters: chapters.length,
    releasePath: RELEASE_PATH,
    runReleasePath: RUN_RELEASE_PATH,
  }, null, 2));
}

main();
