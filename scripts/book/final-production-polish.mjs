#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BOOK_PACKAGES_DIR = path.join(ROOT, "book-packages");
const BOOK_COVERS_DIR = path.join(ROOT, "public", "book-covers");
const COVER_EXTS = [".svg", ".png", ".jpg", ".jpeg", ".webp", ".avif"];
const FORCE_REGEN_COVERS = process.env.FORCE_REGEN_COVERS === "1";

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "in",
  "into",
  "is",
  "it",
  "of",
  "on",
  "or",
  "the",
  "to",
  "under",
  "with",
  "without",
]);

function hash(input) {
  let value = 0;
  for (let index = 0; index < input.length; index += 1) {
    value = ((value << 5) - value + input.charCodeAt(index)) | 0;
  }
  return Math.abs(value);
}

function esc(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function cleanSpaces(text) {
  return String(text || "")
    .replace(/[–—]/g, ", ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}

function capitalizeSentenceStarts(text) {
  if (!text) return text;
  let output = text.replace(/(^|[.!?]\s+)([a-z])/g, (_match, start, letter) => {
    return `${start}${letter.toUpperCase()}`;
  });
  output = output.replace(/^([a-z])/, (match) => match.toUpperCase());
  return output;
}

function ensureTerminalPunctuation(text) {
  if (!text) return text;
  if (/[.!?]$/.test(text)) return text;
  return `${text}.`;
}

function polishText(text) {
  return ensureTerminalPunctuation(capitalizeSentenceStarts(cleanSpaces(text)));
}

function extractLeadName(text) {
  const skip = new Set([
    "A",
    "An",
    "The",
    "At",
    "In",
    "On",
    "When",
    "While",
    "During",
    "After",
    "Before",
    "From",
    "With",
    "Without",
    "Over",
    "Under",
    "Across",
    "Through",
    "This",
    "That",
  ]);
  const tokens = cleanSpaces(text).match(/\b[A-Z][a-z]+\b/g) || [];
  for (const token of tokens) {
    if (!skip.has(token)) return token;
  }
  return null;
}

function extractCandidateNames(text) {
  const skip = new Set([
    "A",
    "An",
    "The",
    "At",
    "In",
    "On",
    "When",
    "While",
    "During",
    "After",
    "Before",
    "From",
    "With",
    "Without",
    "Over",
    "Under",
    "Across",
    "Through",
    "This",
    "That",
    "Small",
    "Good",
    "Personal",
    "Use",
    "Keep",
    "Focus",
  ]);

  const tokens = cleanSpaces(text).match(/\b[A-Z][a-z]+\b/g) || [];
  const counts = new Map();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) || 0) + 1);
  }

  const names = [];
  for (const [token, count] of counts.entries()) {
    if (skip.has(token)) continue;
    if (count >= 2 || new RegExp(`\\b${token}'s\\b`).test(text)) {
      names.push(token);
    }
  }
  return names;
}

function conjugateThirdPerson(verb) {
  const irregular = new Map([
    ["be", "is"],
    ["have", "has"],
    ["do", "does"],
  ]);
  if (irregular.has(verb)) return irregular.get(verb);
  if (/[^aeiou]y$/.test(verb)) return `${verb.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh|o)$/.test(verb)) return `${verb}es`;
  return `${verb}s`;
}

function fixNameVerbAgreement(text, name) {
  let output = text;
  const names = new Set(extractCandidateNames(output));
  if (name) names.add(name);
  for (const commonName of ["Alex", "Jordan", "Maya", "Riley"]) {
    if (new RegExp(`\\b${commonName}\\b`).test(output)) {
      names.add(commonName);
    }
  }
  if (names.size === 0) return output;

  const directSubjectVerbs = [
    "blame",
    "keep",
    "need",
    "want",
    "know",
    "feel",
    "try",
    "tell",
    "say",
    "do",
    "have",
    "use",
    "see",
    "perform",
    "begin",
    "join",
    "enjoy",
    "run",
    "lead",
    "stop",
    "worry",
    "remember",
    "show",
    "contribute",
    "answer",
    "spend",
    "take",
    "evaluate",
    "react",
    "start",
    "open",
    "look",
    "finish",
    "share",
    "admire",
    "bring",
    "treat",
    "explain",
    "test",
    "interrupt",
    "put",
    "understand",
    "attend",
    "brush",
    "expect",
    "review",
    "talk",
    "fall",
    "tend",
    "prefer",
    "read",
    "manage",
    "bomb",
    "sense",
    "hope",
    "praise",
    "consume",
    "hold",
    "act",
    "register",
    "invest",
    "accumulate",
    "prepare",
    "miss",
    "attach",
    "approach",
    "hate",
    "lean",
    "chase",
    "remove",
    "hint",
    "pride",
    "communicate",
    "coordinate",
    "conclude",
    "withdraw",
    "respond",
    "send",
    "trust",
    "question",
    "connect",
    "persist",
    "reduce",
    "lose",
    "freeze",
    "win",
    "rush",
    "grasp",
    "mentor",
    "care",
    "like",
    "keep",
  ];
  const conjoinedVerbs = [
    "feel",
    "start",
    "begin",
    "stop",
    "worry",
    "react",
    "perform",
    "remember",
    "join",
    "lead",
    "run",
    "show",
    "contribute",
    "answer",
    "spend",
    "take",
    "want",
    "need",
    "try",
    "evaluate",
    "open",
    "look",
    "finish",
    "share",
    "admire",
    "bring",
    "treat",
    "explain",
    "test",
    "interrupt",
    "put",
    "understand",
    "attend",
    "brush",
    "expect",
    "review",
    "talk",
    "fall",
    "tend",
    "prefer",
    "read",
    "manage",
    "sense",
    "bomb",
    "hope",
    "praise",
    "consume",
    "hold",
    "act",
    "register",
    "invest",
    "accumulate",
    "prepare",
    "miss",
    "attach",
    "approach",
    "hate",
    "lean",
    "chase",
    "remove",
    "hint",
    "pride",
    "communicate",
    "coordinate",
    "conclude",
    "withdraw",
    "respond",
    "send",
    "trust",
    "question",
    "connect",
    "persist",
    "reduce",
    "lose",
    "freeze",
    "win",
    "rush",
    "grasp",
    "mentor",
    "care",
    "like",
    "keep",
  ];

  const modalWord = /\b(may|might|can|could|would|should|will|must)\b/i;
  const directPrefix =
    "(^|[.!?]\\s+|,\\s+|;\\s+|:\\s+|\\(\\s*|\\b(?:and|but|so|because|while|when|if|after|before|that|which|who|where|how|way|as|then|although|though|unless|means|meaning|since|than|more)\\s+)";
  const directAdverb =
    "((?:(?:still|also|immediately|rarely|quietly|often|usually|just|never|already|only|even|actually|quickly|slowly|simply|really|always)\\s+){0,3})";
  const chainAdverb =
    "((?:(?:still|also|immediately|rarely|quietly|often|usually|just|never|already|only|even|actually|quickly|slowly|simply|really|always)\\s+){0,2})";

  for (const candidate of names) {
    output = output.replace(new RegExp(`\\b${candidate}'s\\b`, "g"), "their");
    output = output.replace(
      new RegExp(`\\b${candidate} ([^.]{0,60}?)\\b${candidate}'s\\b`, "g"),
      `${candidate} $1their`
    );

    for (const verb of directSubjectVerbs) {
      const directRule = new RegExp(`${directPrefix}${candidate}\\s+${directAdverb}${verb}\\b`, "gi");
      output = output.replace(directRule, (_match, prefix, adverb = "") => {
        return `${prefix}${candidate} ${adverb ? `${adverb} ` : ""}${conjugateThirdPerson(verb)}`;
      });
    }

    for (const verb of conjoinedVerbs) {
      const conjoinedRule = new RegExp(`\\b${candidate}\\b([^.!?]{0,220}?)\\band\\s+${chainAdverb}${verb}\\b`, "gi");
      output = output.replace(conjoinedRule, (match, between, adverb = "") => {
        if (modalWord.test(between)) return match;
        return `${candidate}${between}and ${adverb || ""}${conjugateThirdPerson(verb)}`;
      });

      const commaRule = new RegExp(`\\b${candidate}\\b([^.!?]{0,220}?),\\s+${chainAdverb}${verb}\\b`, "gi");
      output = output.replace(commaRule, (match, between, adverb = "") => {
        if (modalWord.test(between)) return match;
        return `${candidate}${between}, ${adverb || ""}${conjugateThirdPerson(verb)}`;
      });
    }

    output = output.replace(
      new RegExp(`\\b(make|makes|made) ${candidate} feels\\b`, "g"),
      `$1 ${candidate} feel`
    );
    output = output.replace(
      new RegExp(`\\bmany people around ${candidate} is\\b`, "g"),
      `many people around ${candidate} are`
    );
    output = output.replace(new RegExp(`\\bmessage ${candidate} send\\b`, "gi"), `message ${candidate} sends`);
    output = output.replace(
      new RegExp(`\\breactive ${candidate} communicate\\b`, "gi"),
      `reactive ${candidate} communicates`
    );
    output = output.replace(new RegExp(`\\bthan ${candidate} actually are\\b`, "g"), "than they actually are");
  }

  output = output.replace(
    /\b(still|also|immediately|rarely|quietly|often|usually|just|never|already|only|even|actually|quickly|slowly|simply|really|always)(has|does|sees|starts|feels|wants|needs|tries|tells|says|keeps|uses|runs|joins|leads|stops|worries|remembers|shows|contributes|answers|spends|takes|evaluates|reacts|performs|begins|enjoys|knows|looks|opens|finishes|shares|admires|brings|treats|explains|tests|interrupts|puts|understands|attends|brushes|expects|reviews|talks|falls|tends|prefers|reads|manages|senses|bombs)\b/gi,
    "$1 $2"
  );

  return output;
}

function chapterKeywords(title) {
  return cleanSpaces(title)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((part) => part.length >= 4 && !STOP_WORDS.has(part));
}

function hasChapterRelevance(chapter, textBlocks) {
  const fullText = cleanSpaces(textBlocks.join(" ").toLowerCase());
  const keywords = chapterKeywords(chapter.title);
  return keywords.some((word) => fullText.includes(word));
}

function normalizeContexts(rawContexts) {
  const normalized = [];
  for (const value of Array.isArray(rawContexts) ? rawContexts : []) {
    const key = cleanSpaces(value).toLowerCase().replace(/[-_]/g, " ");
    if (key.includes("school")) normalized.push("school");
    else if (key.includes("work")) normalized.push("work");
    else normalized.push("personal");
  }
  if (normalized.length > 0) return normalized;
  return ["personal"];
}

function chooseAnchor(chapter) {
  const variants = Object.values(chapter.contentVariants || {});
  const candidates = [];
  for (const variant of variants) {
    if (variant?.importantSummary) candidates.push(variant.importantSummary);
    if (Array.isArray(variant?.keyTakeaways) && variant.keyTakeaways.length > 0) {
      candidates.push(variant.keyTakeaways[0]);
    }
    if (Array.isArray(variant?.takeaways) && variant.takeaways.length > 0) {
      candidates.push(variant.takeaways[0]);
    }
  }
  const fallback = chapter.title;
  const base = cleanSpaces(candidates[0] || fallback);
  const firstSentence = base.split(/[.!?]/)[0] || fallback;
  return cleanSpaces(firstSentence).slice(0, 140);
}

function buildPrompt(chapterTitle, anchor, index, retry = false) {
  const chapter = cleanSpaces(chapterTitle);
  const regularTemplates = [
    `You are making a real-world decision tied to "${chapter}". Which option is the strongest next move?`,
    `In a relatable day-to-day scenario, which choice best puts "${chapter}" into practice?`,
    `When pressure rises, which response best reflects "${chapter}"?`,
    `Which option would be most effective in a realistic situation for "${chapter}"?`,
    `For someone in their twenties handling real constraints, which choice best applies "${chapter}"?`,
  ];
  const retryTemplates = [
    `After reflecting on your first attempt, which option now best applies "${chapter}"?`,
    `You get a second attempt in a realistic scenario. Which choice best puts "${chapter}" into practice?`,
    `In a relatable follow-up situation, which option is the strongest application of "${chapter}"?`,
  ];
  const templates = retry ? retryTemplates : regularTemplates;
  void anchor;
  return templates[index % templates.length];
}

function polishChoice(text) {
  let output = cleanSpaces(text);
  output = output.replace(/^That\s+/i, "");
  output = output.replace(/^This chapter introduces\s+/i, "");
  output = output.replace(/^It argues that\s+/i, "");
  output = output.replace(/^It claims that\s+/i, "");
  output = capitalizeSentenceStarts(output);
  return ensureTerminalPunctuation(output);
}

const COVER_THEME_META = {
  strategy: {
    label: "STRATEGY",
    subtitle: "Position, timing, and leverage",
    titleFont: "Georgia, 'Times New Roman', serif",
    palettes: [
      {
        bgTop: "#0E2A44",
        bgBottom: "#1E486A",
        panel: "#F4ECDD",
        panelStroke: "#CDBA9D",
        ink: "#1C2B34",
        accent: "#D19A34",
        accentSoft: "#7AA4C4",
        light: "#FFF8EE",
      },
      {
        bgTop: "#2B2A3D",
        bgBottom: "#4A486E",
        panel: "#F2ECE1",
        panelStroke: "#C7B9A3",
        ink: "#232733",
        accent: "#D59A43",
        accentSoft: "#8F90C0",
        light: "#FEF8F0",
      },
    ],
  },
  communication: {
    label: "COMMUNICATION",
    subtitle: "Influence, dialogue, and trust",
    titleFont: "'Trebuchet MS', Arial, sans-serif",
    palettes: [
      {
        bgTop: "#2D4A64",
        bgBottom: "#3E6D8C",
        panel: "#F4EFE4",
        panelStroke: "#CBBBA3",
        ink: "#20313C",
        accent: "#E19345",
        accentSoft: "#8DBBCB",
        light: "#FDF8EE",
      },
      {
        bgTop: "#1F3E50",
        bgBottom: "#396A76",
        panel: "#F4ECE0",
        panelStroke: "#CAB7A0",
        ink: "#1E2E33",
        accent: "#D98540",
        accentSoft: "#7CB0A3",
        light: "#FEF8EE",
      },
    ],
  },
  psychology: {
    label: "PSYCHOLOGY",
    subtitle: "Behavior, bias, and motivation",
    titleFont: "Georgia, 'Times New Roman', serif",
    palettes: [
      {
        bgTop: "#3A3E63",
        bgBottom: "#5A5A86",
        panel: "#F2EDE3",
        panelStroke: "#C8B8A7",
        ink: "#24283A",
        accent: "#D59D5A",
        accentSoft: "#9FA8D9",
        light: "#FDF7EE",
      },
      {
        bgTop: "#2D3656",
        bgBottom: "#4E5E8A",
        panel: "#F3ECE2",
        panelStroke: "#C9B8A2",
        ink: "#232B3B",
        accent: "#D88D57",
        accentSoft: "#9AACD2",
        light: "#FDF8EF",
      },
    ],
  },
  productivity: {
    label: "PRODUCTIVITY",
    subtitle: "Focus, habits, and execution",
    titleFont: "'Trebuchet MS', Arial, sans-serif",
    palettes: [
      {
        bgTop: "#274F4C",
        bgBottom: "#3E7364",
        panel: "#F2EEE3",
        panelStroke: "#C6B9A3",
        ink: "#203230",
        accent: "#DB9F4F",
        accentSoft: "#8AC0AB",
        light: "#FBF8EF",
      },
      {
        bgTop: "#205F5D",
        bgBottom: "#3A8279",
        panel: "#F4EEE3",
        panelStroke: "#C8B9A3",
        ink: "#1F3331",
        accent: "#E2A457",
        accentSoft: "#7FC5B8",
        light: "#FDF8EE",
      },
    ],
  },
  leadership: {
    label: "LEADERSHIP",
    subtitle: "Responsibility and alignment",
    titleFont: "Georgia, 'Times New Roman', serif",
    palettes: [
      {
        bgTop: "#30354F",
        bgBottom: "#4F5A79",
        panel: "#F2ECE1",
        panelStroke: "#C7B7A3",
        ink: "#252B3E",
        accent: "#D8A354",
        accentSoft: "#96A8CA",
        light: "#FEF8EE",
      },
      {
        bgTop: "#1E3352",
        bgBottom: "#3F5978",
        panel: "#F4EDE2",
        panelStroke: "#CAB9A3",
        ink: "#223142",
        accent: "#DA9A49",
        accentSoft: "#88A8C7",
        light: "#FDF8EE",
      },
    ],
  },
  finance: {
    label: "MONEY",
    subtitle: "Wealth, risk, and incentives",
    titleFont: "Georgia, 'Times New Roman', serif",
    palettes: [
      {
        bgTop: "#264A37",
        bgBottom: "#3B7557",
        panel: "#F2EEE3",
        panelStroke: "#C6B9A4",
        ink: "#20332A",
        accent: "#E0A33F",
        accentSoft: "#94C2A7",
        light: "#FCF8EF",
      },
      {
        bgTop: "#375B2E",
        bgBottom: "#568346",
        panel: "#F2EDE1",
        panelStroke: "#C6B8A1",
        ink: "#2B3A24",
        accent: "#DCA255",
        accentSoft: "#9CC09C",
        light: "#FDF8EE",
      },
    ],
  },
  learning: {
    label: "LEARNING",
    subtitle: "Practice and skill building",
    titleFont: "'Trebuchet MS', Arial, sans-serif",
    palettes: [
      {
        bgTop: "#2D4A6A",
        bgBottom: "#4B7AA3",
        panel: "#F4EEE3",
        panelStroke: "#CABAA4",
        ink: "#223445",
        accent: "#E29C48",
        accentSoft: "#8EB4D1",
        light: "#FDF8EE",
      },
      {
        bgTop: "#314C74",
        bgBottom: "#5578A6",
        panel: "#F3ECE1",
        panelStroke: "#C8B8A2",
        ink: "#25364A",
        accent: "#DE9A4A",
        accentSoft: "#9CB9DA",
        light: "#FEF8EF",
      },
    ],
  },
  philosophy: {
    label: "PHILOSOPHY",
    subtitle: "Meaning and perspective",
    titleFont: "Georgia, 'Times New Roman', serif",
    palettes: [
      {
        bgTop: "#4C3D30",
        bgBottom: "#6C5845",
        panel: "#F3ECE0",
        panelStroke: "#C7B7A1",
        ink: "#332920",
        accent: "#D8A060",
        accentSoft: "#B7A28B",
        light: "#FDF7EC",
      },
      {
        bgTop: "#3F3A32",
        bgBottom: "#5F574A",
        panel: "#F3ECE2",
        panelStroke: "#C8B8A2",
        ink: "#322C25",
        accent: "#D6A160",
        accentSoft: "#B39F88",
        light: "#FEF8EE",
      },
    ],
  },
  relationships: {
    label: "RELATIONSHIPS",
    subtitle: "Attachment and connection",
    titleFont: "'Trebuchet MS', Arial, sans-serif",
    palettes: [
      {
        bgTop: "#5B3D57",
        bgBottom: "#7A5575",
        panel: "#F3EDE3",
        panelStroke: "#C8B7A4",
        ink: "#352635",
        accent: "#E0A35C",
        accentSoft: "#C4A2C3",
        light: "#FDF8EE",
      },
      {
        bgTop: "#6A3F52",
        bgBottom: "#8B5E6D",
        panel: "#F4ECE2",
        panelStroke: "#C9B7A1",
        ink: "#3A2A34",
        accent: "#DD9A54",
        accentSoft: "#C79BB1",
        light: "#FDF8EE",
      },
    ],
  },
  innovation: {
    label: "INNOVATION",
    subtitle: "Entrepreneurship and growth",
    titleFont: "'Trebuchet MS', Arial, sans-serif",
    palettes: [
      {
        bgTop: "#1F3C5C",
        bgBottom: "#345C85",
        panel: "#F3ECE1",
        panelStroke: "#C7B8A3",
        ink: "#213244",
        accent: "#F29B4B",
        accentSoft: "#8EB0D4",
        light: "#FDF8EE",
      },
      {
        bgTop: "#234057",
        bgBottom: "#3C6E7C",
        panel: "#F4ECE2",
        panelStroke: "#C8B8A2",
        ink: "#22343B",
        accent: "#EB9A4F",
        accentSoft: "#8CBCC6",
        light: "#FDF8EE",
      },
    ],
  },
  thinking: {
    label: "THINKING",
    subtitle: "Mental models and judgment",
    titleFont: "Georgia, 'Times New Roman', serif",
    palettes: [
      {
        bgTop: "#2A3F5B",
        bgBottom: "#3F5F86",
        panel: "#F3ECE0",
        panelStroke: "#C8B7A1",
        ink: "#233244",
        accent: "#E4A150",
        accentSoft: "#93B0CE",
        light: "#FDF8EE",
      },
      {
        bgTop: "#2A3951",
        bgBottom: "#48658C",
        panel: "#F4EDE2",
        panelStroke: "#CAB8A2",
        ink: "#243344",
        accent: "#DB9850",
        accentSoft: "#9CB4D1",
        light: "#FDF8EF",
      },
    ],
  },
  resilience: {
    label: "RESILIENCE",
    subtitle: "Stoicism and mental toughness",
    titleFont: "Georgia, 'Times New Roman', serif",
    palettes: [
      {
        bgTop: "#32425A",
        bgBottom: "#4D627D",
        panel: "#F2ECE1",
        panelStroke: "#C8B7A1",
        ink: "#273648",
        accent: "#DFA052",
        accentSoft: "#9FB3C9",
        light: "#FDF8EE",
      },
      {
        bgTop: "#3D445F",
        bgBottom: "#5A658A",
        panel: "#F4EDE2",
        panelStroke: "#CAB9A3",
        ink: "#2C3247",
        accent: "#E09F57",
        accentSoft: "#A9B7D1",
        light: "#FEF8EE",
      },
    ],
  },
};

const CATEGORY_THEME_MAP = {
  Strategy: "strategy",
  Business: "innovation",
  Entrepreneurship: "innovation",
  Innovation: "innovation",
  Product: "innovation",
  Communication: "communication",
  Negotiation: "communication",
  Conflict: "communication",
  Persuasion: "communication",
  "Social Skills": "communication",
  Psychology: "psychology",
  "Human Behavior": "psychology",
  Behavior: "psychology",
  "Behavior Change": "psychology",
  "Behavioral Economics": "psychology",
  Leadership: "leadership",
  Management: "leadership",
  Execution: "leadership",
  Productivity: "productivity",
  Focus: "productivity",
  Attention: "productivity",
  "Self Management": "productivity",
  "Self Improvement": "productivity",
  "Personal Development": "productivity",
  "Self Development": "productivity",
  Learning: "learning",
  "Skill Building": "learning",
  Education: "learning",
  "Decision Making": "thinking",
  Thinking: "thinking",
  "Mental Models": "thinking",
  Risk: "thinking",
  Finance: "finance",
  Wealth: "finance",
  "Personal Finance": "finance",
  Relationships: "relationships",
  Philosophy: "philosophy",
  Stoicism: "philosophy",
  Meaning: "philosophy",
  Ethics: "philosophy",
  Politics: "philosophy",
  Society: "philosophy",
  Resilience: "resilience",
  "Mental Toughness": "resilience",
  "Self Mastery": "resilience",
  "Self Discipline": "resilience",
};

const COVER_THEME_KEYWORDS = {
  strategy: ["strategy", "power", "war", "game", "positioning", "competition", "timing", "influence"],
  communication: ["communication", "conversation", "negotiation", "dialogue", "rapport", "persuasion", "talk"],
  psychology: ["psychology", "bias", "behavior", "motives", "mind", "emotion", "social", "attachment"],
  productivity: ["productivity", "focus", "habit", "execution", "workflow", "consistency", "time", "discipline"],
  leadership: ["leadership", "teams", "management", "ownership", "responsibility", "culture", "alignment"],
  finance: ["money", "wealth", "finance", "investing", "incentives", "capital", "economics"],
  learning: ["learning", "practice", "memory", "skill", "study", "mastery", "training", "teaching"],
  philosophy: ["philosophy", "meaning", "ethics", "stoicism", "purpose", "mortality", "wisdom"],
  relationships: ["relationship", "dating", "connection", "trust", "friendship", "attachment", "intimacy"],
  innovation: ["startup", "innovation", "entrepreneurship", "product", "market", "growth", "disruption"],
  thinking: ["thinking", "models", "judgment", "decision", "reasoning", "clarity", "uncertainty"],
  resilience: ["resilience", "grit", "toughness", "obstacle", "adversity", "courage", "endurance"],
};

const COVER_THEME_DEFAULT_MOTIFS = {
  strategy: ["chess-grid", "crossed-swords", "compass-star"],
  communication: ["speech-bubbles", "microphone", "handshake-split"],
  psychology: ["mind-network", "mask-dual", "interlocked-rings"],
  productivity: ["checklist-board", "dot-grid", "hourglass-track"],
  leadership: ["compass-star", "crown-sigil", "flag-peak"],
  finance: ["bar-coin", "stacked-coins", "line-chart"],
  learning: ["open-book", "pencil-line", "node-map"],
  philosophy: ["column-arch", "scale-balance", "mountain-sun"],
  relationships: ["interlocked-rings", "bridge-arc", "heart-link"],
  innovation: ["rocket", "flywheel", "wave-surge"],
  thinking: ["node-map", "maze-grid", "zero-one"],
  resilience: ["mountain-sun", "shield-mark", "anvil-mark"],
};

const COVER_MOTIF_KEYWORDS = {
  "dot-grid": ["habit", "habits", "tiny", "atomic", "consistency", "small"],
  "focus-block": ["focus", "deep", "indistractable", "attention", "concentration"],
  "pencil-line": ["thinking", "clearly", "learn", "learning", "study"],
  "loop-arrows": ["habit", "loop", "routine", "behavior-change", "behavior"],
  "bullet-dot": ["one", "essentialism", "priority", "single", "thing"],
  "target-rings": ["why", "purpose", "okrs", "measure", "goal", "goals"],
  "crown-sigil": ["power", "prince", "laws", "authority", "status"],
  "crossed-swords": ["war", "strategy", "battle", "conflict"],
  "handshake-split": ["negotiation", "split", "difference", "deal", "conflict"],
  "magnet-u": ["influence", "persuasion", "pre-suasion", "charisma"],
  "microphone": ["talk", "ted", "pitch", "speak", "speaking", "presentation"],
  "wave-surge": ["ocean", "flow", "blue", "momentum"],
  "swan-curve": ["black", "swan", "uncertainty", "tail-risk"],
  flywheel: ["startup", "lean", "iteration", "product", "innovation"],
  "zero-one": ["zero", "one", "differentiation", "monopoly", "new"],
  "stacked-coins": ["money", "wealth", "finance", "investing", "capital"],
  "bar-coin": ["psychology-of-money", "economics", "incentives"],
  "column-arch": ["meditations", "stoicism", "philosophy", "meaning", "wisdom"],
  "mountain-sun": ["obstacle", "grit", "resilience", "discipline", "hard"],
  "checklist-board": ["checklist", "execution", "gtd", "productivity"],
  "shield-mark": ["ownership", "toughness", "cant-hurt-me", "fear"],
  pyramid: ["pyramid", "principle", "structure", "logic"],
};

const COVER_BOOK_OVERRIDES = {
  "atomic-habits": { motif: "dot-grid", theme: "productivity", subtitle: "Small habits compound into big outcomes" },
  "deep-work": { motif: "focus-block", theme: "productivity", subtitle: "Focus deeply on work that truly matters" },
  "thinking-fast-and-slow": { motif: "pencil-line", theme: "thinking", subtitle: "Two systems of thought in tension" },
  "the-power-of-habit": { motif: "loop-arrows", theme: "productivity", subtitle: "Cue, routine, and reward in daily life" },
  "the-one-thing": { motif: "bullet-dot", theme: "productivity", subtitle: "One priority that makes everything easier" },
  "start-with-why": { motif: "target-rings", theme: "leadership", subtitle: "Purpose first, then action and execution" },
  "the-48-laws-of-power": { motif: "crown-sigil", theme: "strategy", subtitle: "Status, timing, and strategic positioning" },
  "art-of-war": { motif: "crossed-swords", theme: "strategy", subtitle: "Win through positioning, not just force" },
  "33-strategies-of-war": { motif: "chess-grid", theme: "strategy", subtitle: "Tactical choices under pressure" },
  "never-split-the-difference": { motif: "handshake-split", theme: "communication", subtitle: "Negotiation through calibrated empathy" },
  influence: { motif: "magnet-u", theme: "communication", subtitle: "Psychology of persuasion in real decisions" },
  "pre-suasion": { motif: "magnet-u", theme: "communication", subtitle: "Prime attention before you make the ask" },
  "talk-like-ted": { motif: "microphone", theme: "communication", subtitle: "Stories and delivery that move people" },
  "how-to-talk-to-anyone": { motif: "speech-bubbles", theme: "communication", subtitle: "Social ease through practical communication skills" },
  "the-psychology-of-money": { motif: "bar-coin", theme: "finance", subtitle: "Behavior and incentives behind money decisions" },
  "rich-dad-poor-dad": { motif: "stacked-coins", theme: "finance", subtitle: "Mindset and systems for building wealth" },
  "blue-ocean-strategy": { motif: "wave-surge", theme: "strategy", subtitle: "Create uncontested space instead of competing harder" },
  "the-black-swan": { motif: "swan-curve", theme: "thinking", subtitle: "Outlier events and hidden uncertainty" },
  "the-lean-startup": { motif: "flywheel", theme: "innovation", subtitle: "Build, measure, learn in tight cycles" },
  "zero-to-one": { motif: "zero-one", theme: "innovation", subtitle: "Move from incremental to truly new value" },
  "the-checklist-manifesto": { motif: "checklist-board", theme: "productivity", subtitle: "Reliability through simple disciplined systems" },
  meditations: { motif: "column-arch", theme: "philosophy", subtitle: "Calm judgment under pressure and uncertainty" },
  "the-obstacle-is-the-way": { motif: "mountain-sun", theme: "resilience", subtitle: "Turn friction into progress and strength" },
  "cant-hurt-me": { motif: "shield-mark", theme: "resilience", subtitle: "Mental toughness through deliberate adversity" },
  "the-prince": { motif: "crown-sigil", theme: "strategy", subtitle: "Power, governance, and political realism" },
  "the-pyramid-principle": { motif: "pyramid", theme: "thinking", subtitle: "Structured argument and clear executive communication" },
  attached: { motif: "interlocked-rings", theme: "relationships", subtitle: "Attachment patterns in modern relationships" },
};

const COVER_PALETTE_OVERRIDES = {
  "atomic-habits": { bgTop: "#D6A91F", bgBottom: "#F1C94C", panel: "#FFF9E8", panelStroke: "#D0B25D", ink: "#2B2B22", accent: "#3B4C6B", accentSoft: "#D9B24B", light: "#FFFDF6" },
  "deep-work": { bgTop: "#0F2F58", bgBottom: "#20518A", panel: "#F8FBFF", panelStroke: "#B6C5D8", ink: "#15253B", accent: "#1B3F73", accentSoft: "#88A9D0", light: "#FFFFFF" },
  "the-48-laws-of-power": { bgTop: "#131313", bgBottom: "#2A2A2A", panel: "#F0E5D0", panelStroke: "#BDA57D", ink: "#1B140D", accent: "#9E1B1B", accentSoft: "#6C6C6C", light: "#FFF9EE" },
  "art-of-war": { bgTop: "#541B1B", bgBottom: "#7A2A2A", panel: "#F3E5D2", panelStroke: "#C5A276", ink: "#2E1A13", accent: "#B98A3C", accentSoft: "#AC6A5A", light: "#FFF6EA" },
  "the-psychology-of-money": { bgTop: "#1F513A", bgBottom: "#2F7A58", panel: "#F4F1E5", panelStroke: "#B8B193", ink: "#1E3128", accent: "#CFA34C", accentSoft: "#89B39C", light: "#FCFAF1" },
  "rich-dad-poor-dad": { bgTop: "#4C2D7A", bgBottom: "#6E44A3", panel: "#F4EDEE", panelStroke: "#C3B0C9", ink: "#2E2240", accent: "#E0B043", accentSoft: "#A890C2", light: "#FDF7FF" },
  "thinking-fast-and-slow": { bgTop: "#E9ECEF", bgBottom: "#C9D0D8", panel: "#FFFFFF", panelStroke: "#BFC7D0", ink: "#2A3139", accent: "#E3A542", accentSoft: "#8DA0B3", light: "#FFFFFF" },
  "the-one-thing": { bgTop: "#1D1D1D", bgBottom: "#3B3B3B", panel: "#FAFAFA", panelStroke: "#D3D3D3", ink: "#141414", accent: "#3D3D3D", accentSoft: "#8E8E8E", light: "#FFFFFF" },
  "start-with-why": { bgTop: "#8A1E1E", bgBottom: "#B73535", panel: "#F9EFE5", panelStroke: "#D2B8A1", ink: "#2D1A15", accent: "#F1C15F", accentSoft: "#CB7474", light: "#FFF8F0" },
  "blue-ocean-strategy": { bgTop: "#1D4A6D", bgBottom: "#2B7BA6", panel: "#F1F8FC", panelStroke: "#AAC5D8", ink: "#1C2F3E", accent: "#58A8D6", accentSoft: "#9ED3E8", light: "#F8FDFF" },
  "the-black-swan": { bgTop: "#0F0F0F", bgBottom: "#2A2A2A", panel: "#F5F4EF", panelStroke: "#BFBBAF", ink: "#1D1D1D", accent: "#101010", accentSoft: "#7B7B7B", light: "#FFFFFF" },
  "the-lean-startup": { bgTop: "#1F4E8C", bgBottom: "#2D73C2", panel: "#F4F8FC", panelStroke: "#B0C2D6", ink: "#1B2F46", accent: "#3B86D9", accentSoft: "#8AB3DF", light: "#FFFFFF" },
  "cant-hurt-me": { bgTop: "#1A1A1A", bgBottom: "#3B3B3B", panel: "#F1ECE4", panelStroke: "#BFB3A5", ink: "#191512", accent: "#C9782A", accentSoft: "#8E8E8E", light: "#FFF8EE" },
};

function chooseCoverMotif(book, theme, bookId) {
  const override = COVER_BOOK_OVERRIDES[bookId];
  if (override?.motif) return override.motif;

  const words = cleanSpaces([book.title, ...(book.categories || []), ...(book.tags || [])].join(" "))
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const scores = new Map();
  for (const [motif, keywords] of Object.entries(COVER_MOTIF_KEYWORDS)) {
    let value = 0;
    for (const word of words) {
      if (keywords.includes(word)) value += 2;
      if (word.includes("-")) {
        const normalized = word.replace(/-/g, "");
        if (keywords.includes(normalized)) value += 1;
      }
    }
    if (value > 0) scores.set(motif, value);
  }

  if (scores.size > 0) {
    let best = null;
    let bestScore = -1;
    for (const [motif, value] of scores.entries()) {
      if (value > bestScore) {
        best = motif;
        bestScore = value;
      }
    }
    if (best) return best;
  }

  const defaults = COVER_THEME_DEFAULT_MOTIFS[theme] || COVER_THEME_DEFAULT_MOTIFS.thinking;
  return defaults[hash(`${bookId}|${theme}|motif`) % defaults.length];
}

function chooseCoverTheme(book) {
  const score = new Map(Object.keys(COVER_THEME_META).map((key) => [key, 0]));
  const categories = Array.isArray(book.categories) ? book.categories : [];
  for (const category of categories) {
    const mapped = CATEGORY_THEME_MAP[category];
    if (mapped) score.set(mapped, (score.get(mapped) || 0) + 6);
  }

  const words = cleanSpaces([book.title, ...(book.categories || []), ...(book.tags || [])].join(" "))
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  for (const [theme, keywords] of Object.entries(COVER_THEME_KEYWORDS)) {
    for (const word of words) {
      if (keywords.includes(word)) {
        score.set(theme, (score.get(theme) || 0) + 2);
      }
      for (const key of keywords) {
        if (key.includes("-") && word === key.replace("-", "")) {
          score.set(theme, (score.get(theme) || 0) + 1);
        }
      }
    }
  }

  let bestTheme = "thinking";
  let bestScore = -1;
  for (const [theme, value] of score.entries()) {
    if (value > bestScore) {
      bestScore = value;
      bestTheme = theme;
    }
  }
  return bestTheme;
}

function splitTitle(title, maxLines = 4) {
  const words = cleanSpaces(title).split(/\s+/);
  if (words.length <= 4) return [cleanSpaces(title).toUpperCase()];
  const lineCount = Math.min(maxLines, words.length <= 8 ? 3 : 4);
  const target = Math.ceil(words.length / lineCount);
  const lines = [];
  let current = [];
  for (const word of words) {
    current.push(word);
    if (current.length >= target && lines.length < lineCount - 1) {
      lines.push(current.join(" ").toUpperCase());
      current = [];
    }
  }
  if (current.length > 0) lines.push(current.join(" ").toUpperCase());
  return lines.slice(0, lineCount);
}

function titleFontSize(lines) {
  const longest = lines.reduce((max, line) => Math.max(max, line.length), 0);
  if (longest <= 12) return 108;
  if (longest <= 18) return 92;
  if (longest <= 26) return 78;
  return 64;
}

function keywordLine(book, themeLabel) {
  const source = [...(book.tags || []), ...(book.categories || [])]
    .map((value) => cleanSpaces(value).toUpperCase())
    .filter(Boolean);
  const unique = [];
  for (const value of source) {
    if (!unique.includes(value)) unique.push(value);
  }
  const line = unique.slice(0, 3).join("  ·  ");
  return line || themeLabel;
}

function renderCoverLayout(layoutVariant, palette, seed) {
  const dx = (seed % 60) - 30;
  const dy = ((seed >> 3) % 50) - 25;
  switch (layoutVariant % 5) {
    case 0:
      return `
  <rect x="-120" y="310" width="820" height="1100" transform="rotate(-12 400 860)" fill="${palette.accentSoft}" opacity="0.24"/>
  <rect x="560" y="260" width="760" height="1150" transform="rotate(8 940 835)" fill="${palette.accent}" opacity="0.16"/>
  <circle cx="${250 + dx}" cy="${560 + dy}" r="180" fill="${palette.accent}" opacity="0.17"/>
  <circle cx="${980 - dx}" cy="${1040 - dy}" r="220" fill="${palette.accentSoft}" opacity="0.2"/>`;
    case 1:
      return `
  <rect x="0" y="300" width="1200" height="1180" fill="${palette.accentSoft}" opacity="0.12"/>
  <rect x="140" y="360" width="920" height="1050" rx="48" fill="${palette.light}" opacity="0.22"/>
  <path d="M0 560 Q300 ${440 + dy} 600 560 T1200 560" stroke="${palette.light}" stroke-width="22" opacity="0.24"/>
  <path d="M0 1180 Q300 ${1060 + dy} 600 1180 T1200 1180" stroke="${palette.accent}" stroke-width="16" opacity="0.22"/>`;
    case 2:
      return `
  <circle cx="600" cy="840" r="420" fill="${palette.accentSoft}" opacity="0.16"/>
  <circle cx="600" cy="840" r="300" fill="${palette.light}" opacity="0.16"/>
  <circle cx="${600 + dx}" cy="${840 + dy}" r="210" fill="${palette.accent}" opacity="0.18"/>
  <circle cx="${600 - dx}" cy="${840 - dy}" r="130" fill="${palette.light}" opacity="0.34"/>`;
    case 3:
      return `
  <rect x="0" y="300" width="1200" height="1180" fill="${palette.accentSoft}" opacity="0.1"/>
  <g stroke="${palette.light}" opacity="0.2">
    <line x1="160" y1="320" x2="160" y2="1460" stroke-width="4"/>
    <line x1="320" y1="320" x2="320" y2="1460" stroke-width="3"/>
    <line x1="480" y1="320" x2="480" y2="1460" stroke-width="2"/>
    <line x1="640" y1="320" x2="640" y2="1460" stroke-width="3"/>
    <line x1="800" y1="320" x2="800" y2="1460" stroke-width="2"/>
    <line x1="960" y1="320" x2="960" y2="1460" stroke-width="3"/>
  </g>
  <path d="M140 430 L1060 430" stroke="${palette.accent}" stroke-width="10" opacity="0.22"/>
  <path d="M140 1330 L1060 1330" stroke="${palette.accent}" stroke-width="10" opacity="0.2"/>`;
    default:
      return `
  <rect x="0" y="300" width="1200" height="1180" fill="${palette.accentSoft}" opacity="0.12"/>
  <rect x="110" y="370" width="420" height="420" rx="42" fill="${palette.light}" opacity="0.2"/>
  <rect x="670" y="360" width="420" height="430" rx="42" fill="${palette.accent}" opacity="0.16"/>
  <rect x="110" y="980" width="420" height="360" rx="42" fill="${palette.accent}" opacity="0.15"/>
  <rect x="670" y="950" width="420" height="390" rx="42" fill="${palette.light}" opacity="0.2"/>`;
  }
}

function renderThemeSymbol(theme, palette, seed) {
  const sx = (seed % 30) - 15;
  const sy = ((seed >> 4) % 26) - 13;
  switch (theme) {
    case "strategy":
      return `
  <g transform="translate(${415 + sx} ${565 + sy})">
    <rect x="0" y="0" width="370" height="330" rx="24" fill="${palette.light}" opacity="0.92" stroke="${palette.accentSoft}" stroke-width="8"/>
    <g stroke="${palette.accentSoft}" stroke-width="3" opacity="0.8">
      <line x1="92" y1="0" x2="92" y2="330"/>
      <line x1="184" y1="0" x2="184" y2="330"/>
      <line x1="276" y1="0" x2="276" y2="330"/>
      <line x1="0" y1="82" x2="370" y2="82"/>
      <line x1="0" y1="164" x2="370" y2="164"/>
      <line x1="0" y1="246" x2="370" y2="246"/>
    </g>
    <path d="M46 260 L136 182 L198 222 L318 112" stroke="${palette.accent}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
    <polygon points="318,112 284,114 304,140" fill="${palette.accent}"/>
  </g>`;
    case "communication":
      return `
  <g transform="translate(${400 + sx} ${575 + sy})">
    <path d="M30 46 H270 Q304 46 304 80 V188 Q304 222 270 222 H150 L110 260 L110 222 H30 Q-4 222 -4 188 V80 Q-4 46 30 46 Z" fill="${palette.light}" stroke="${palette.accentSoft}" stroke-width="8"/>
    <path d="M194 142 H366 Q398 142 398 174 V280 Q398 312 366 312 H280 L244 346 V312 H194 Q162 312 162 280 V174 Q162 142 194 142 Z" fill="${palette.accent}" opacity="0.86"/>
    <circle cx="86" cy="132" r="12" fill="${palette.ink}"/>
    <circle cx="148" cy="132" r="12" fill="${palette.ink}"/>
    <circle cx="210" cy="132" r="12" fill="${palette.ink}"/>
    <rect x="214" y="222" width="132" height="14" rx="7" fill="${palette.light}" opacity="0.92"/>
    <rect x="214" y="252" width="102" height="14" rx="7" fill="${palette.light}" opacity="0.92"/>
  </g>`;
    case "psychology":
      return `
  <g transform="translate(${410 + sx} ${560 + sy})">
    <circle cx="180" cy="180" r="158" fill="${palette.light}" opacity="0.95" stroke="${palette.accentSoft}" stroke-width="8"/>
    <path d="M148 76 Q92 120 92 190 Q92 258 144 292 Q198 326 258 290 Q304 264 318 220 Q332 178 306 138 Q280 98 232 82 Q192 68 148 76 Z" fill="none" stroke="${palette.ink}" stroke-width="10" opacity="0.72"/>
    <g stroke="${palette.accent}" stroke-width="6" opacity="0.88">
      <line x1="126" y1="146" x2="188" y2="122"/>
      <line x1="188" y1="122" x2="238" y2="156"/>
      <line x1="188" y1="122" x2="184" y2="196"/>
      <line x1="184" y1="196" x2="246" y2="230"/>
      <line x1="126" y1="146" x2="128" y2="220"/>
      <line x1="128" y1="220" x2="184" y2="196"/>
    </g>
    <g fill="${palette.accent}">
      <circle cx="126" cy="146" r="12"/>
      <circle cx="188" cy="122" r="12"/>
      <circle cx="238" cy="156" r="12"/>
      <circle cx="184" cy="196" r="12"/>
      <circle cx="128" cy="220" r="12"/>
      <circle cx="246" cy="230" r="12"/>
    </g>
  </g>`;
    case "productivity":
      return `
  <g transform="translate(${408 + sx} ${568 + sy})">
    <rect x="0" y="0" width="384" height="334" rx="26" fill="${palette.light}" stroke="${palette.accentSoft}" stroke-width="8"/>
    <rect x="34" y="46" width="316" height="28" rx="12" fill="${palette.accentSoft}" opacity="0.55"/>
    <g stroke="${palette.ink}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">
      <rect x="42" y="108" width="40" height="40" rx="8" fill="none"/>
      <path d="M52 128 L62 138 L82 116"/>
      <rect x="42" y="174" width="40" height="40" rx="8" fill="none"/>
      <path d="M52 194 L62 204 L82 182"/>
      <rect x="42" y="240" width="40" height="40" rx="8" fill="none"/>
      <path d="M52 260 L62 270 L82 248"/>
    </g>
    <rect x="106" y="112" width="240" height="28" rx="10" fill="${palette.accent}" opacity="0.8"/>
    <rect x="106" y="178" width="224" height="28" rx="10" fill="${palette.accentSoft}" opacity="0.72"/>
    <rect x="106" y="244" width="258" height="28" rx="10" fill="${palette.accent}" opacity="0.7"/>
  </g>`;
    case "leadership":
      return `
  <g transform="translate(${404 + sx} ${556 + sy})">
    <circle cx="196" cy="196" r="188" fill="${palette.light}" opacity="0.95" stroke="${palette.accentSoft}" stroke-width="10"/>
    <circle cx="196" cy="196" r="124" fill="none" stroke="${palette.accent}" stroke-width="14" opacity="0.8"/>
    <polygon points="196,52 226,166 340,196 226,226 196,340 166,226 52,196 166,166" fill="${palette.accent}" opacity="0.92"/>
    <circle cx="196" cy="196" r="36" fill="${palette.ink}" opacity="0.84"/>
  </g>`;
    case "finance":
      return `
  <g transform="translate(${402 + sx} ${566 + sy})">
    <rect x="0" y="0" width="396" height="336" rx="24" fill="${palette.light}" stroke="${palette.accentSoft}" stroke-width="8"/>
    <rect x="58" y="214" width="56" height="90" rx="12" fill="${palette.accentSoft}" opacity="0.85"/>
    <rect x="142" y="174" width="56" height="130" rx="12" fill="${palette.accent}" opacity="0.82"/>
    <rect x="226" y="128" width="56" height="176" rx="12" fill="${palette.accentSoft}" opacity="0.88"/>
    <rect x="310" y="92" width="56" height="212" rx="12" fill="${palette.accent}" opacity="0.9"/>
    <path d="M44 236 L112 206 L170 184 L252 134 L332 108" stroke="${palette.ink}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="334" cy="108" r="16" fill="${palette.ink}"/>
    <circle cx="84" cy="78" r="34" fill="${palette.accent}" opacity="0.88"/>
    <text x="84" y="89" text-anchor="middle" fill="${palette.light}" font-family="Georgia, serif" font-size="34" font-weight="700">$</text>
  </g>`;
    case "learning":
      return `
  <g transform="translate(${396 + sx} ${570 + sy})">
    <path d="M18 56 Q118 6 218 56 V302 Q118 252 18 302 Z" fill="${palette.light}" stroke="${palette.accentSoft}" stroke-width="8"/>
    <path d="M382 56 Q282 6 182 56 V302 Q282 252 382 302 Z" fill="${palette.light}" stroke="${palette.accentSoft}" stroke-width="8"/>
    <path d="M200 62 Q200 22 200 8" stroke="${palette.accent}" stroke-width="10" stroke-linecap="round"/>
    <rect x="76" y="106" width="94" height="12" rx="6" fill="${palette.accent}" opacity="0.76"/>
    <rect x="76" y="138" width="112" height="12" rx="6" fill="${palette.accentSoft}" opacity="0.76"/>
    <rect x="76" y="170" width="98" height="12" rx="6" fill="${palette.accent}" opacity="0.76"/>
    <rect x="226" y="106" width="94" height="12" rx="6" fill="${palette.accent}" opacity="0.76"/>
    <rect x="214" y="138" width="112" height="12" rx="6" fill="${palette.accentSoft}" opacity="0.76"/>
    <rect x="224" y="170" width="98" height="12" rx="6" fill="${palette.accent}" opacity="0.76"/>
  </g>`;
    case "philosophy":
      return `
  <g transform="translate(${410 + sx} ${546 + sy})">
    <circle cx="190" cy="112" r="58" fill="${palette.accent}" opacity="0.3"/>
    <rect x="70" y="130" width="240" height="24" rx="10" fill="${palette.accentSoft}" opacity="0.8"/>
    <rect x="92" y="152" width="196" height="34" rx="12" fill="${palette.light}" stroke="${palette.accentSoft}" stroke-width="6"/>
    <g fill="${palette.light}" stroke="${palette.accentSoft}" stroke-width="6">
      <rect x="106" y="184" width="38" height="170" rx="10"/>
      <rect x="170" y="184" width="38" height="170" rx="10"/>
      <rect x="234" y="184" width="38" height="170" rx="10"/>
    </g>
    <rect x="78" y="356" width="224" height="26" rx="10" fill="${palette.accent}" opacity="0.78"/>
  </g>`;
    case "relationships":
      return `
  <g transform="translate(${404 + sx} ${562 + sy})">
    <circle cx="146" cy="174" r="92" fill="none" stroke="${palette.accent}" stroke-width="20"/>
    <circle cx="258" cy="174" r="92" fill="none" stroke="${palette.accentSoft}" stroke-width="20"/>
    <path d="M144 286 Q202 350 258 286" stroke="${palette.ink}" stroke-width="12" stroke-linecap="round"/>
    <rect x="82" y="52" width="240" height="282" rx="28" fill="none" stroke="${palette.light}" stroke-width="7" opacity="0.82"/>
  </g>`;
    case "innovation":
      return `
  <g transform="translate(${408 + sx} ${552 + sy})">
    <path d="M198 20 C272 74 304 146 304 212 C304 284 254 332 198 364 C142 332 92 284 92 212 C92 146 124 74 198 20 Z" fill="${palette.accent}" opacity="0.9"/>
    <circle cx="198" cy="156" r="44" fill="${palette.light}" opacity="0.95"/>
    <path d="M176 224 L220 224 L236 320 L160 320 Z" fill="${palette.light}" opacity="0.94"/>
    <path d="M110 270 L58 302 L104 314 Z" fill="${palette.accentSoft}" opacity="0.9"/>
    <path d="M286 270 L338 302 L292 314 Z" fill="${palette.accentSoft}" opacity="0.9"/>
    <circle cx="72" cy="94" r="8" fill="${palette.light}"/>
    <circle cx="328" cy="114" r="10" fill="${palette.light}"/>
    <circle cx="304" cy="56" r="6" fill="${palette.light}"/>
  </g>`;
    case "resilience":
      return `
  <g transform="translate(${396 + sx} ${564 + sy})">
    <circle cx="204" cy="72" r="44" fill="${palette.accent}" opacity="0.44"/>
    <path d="M24 292 L132 144 L208 248 L296 114 L388 292 Z" fill="${palette.accentSoft}" opacity="0.82"/>
    <path d="M84 292 L168 186 L226 260 L302 172 L360 292 Z" fill="${palette.accent}" opacity="0.82"/>
    <path d="M34 292 H378" stroke="${palette.light}" stroke-width="12" stroke-linecap="round" opacity="0.8"/>
    <path d="M196 146 L210 166 L232 170 L216 186 L220 208 L198 196 L176 208 L180 186 L164 170 L186 166 Z" fill="${palette.light}" opacity="0.9"/>
  </g>`;
    case "thinking":
    default:
      return `
  <g transform="translate(${396 + sx} ${558 + sy})">
    <rect x="20" y="36" width="364" height="324" rx="26" fill="${palette.light}" stroke="${palette.accentSoft}" stroke-width="8"/>
    <g stroke="${palette.accent}" stroke-width="8" opacity="0.86">
      <line x1="82" y1="92" x2="184" y2="146"/>
      <line x1="184" y1="146" x2="286" y2="108"/>
      <line x1="184" y1="146" x2="168" y2="248"/>
      <line x1="168" y1="248" x2="286" y2="288"/>
      <line x1="286" y1="108" x2="286" y2="288"/>
      <line x1="82" y1="92" x2="90" y2="232"/>
      <line x1="90" y1="232" x2="168" y2="248"/>
    </g>
    <g fill="${palette.ink}">
      <circle cx="82" cy="92" r="14"/>
      <circle cx="184" cy="146" r="14"/>
      <circle cx="286" cy="108" r="14"/>
      <circle cx="90" cy="232" r="14"/>
      <circle cx="168" cy="248" r="14"/>
      <circle cx="286" cy="288" r="14"/>
    </g>
  </g>`;
  }
}

function renderCoverMotif(motif, theme, palette, seed) {
  const sx = (seed % 30) - 15;
  const sy = ((seed >> 4) % 26) - 13;

  switch (motif) {
    case "chess-grid":
      return `
  <g transform="translate(${402 + sx} ${554 + sy})">
    <rect x="0" y="0" width="396" height="336" rx="24" fill="${palette.light}" stroke="${palette.accentSoft}" stroke-width="8"/>
    ${Array.from({ length: 4 })
      .map((_r, row) =>
        Array.from({ length: 4 })
          .map((_c, col) => {
            const x = 52 + col * 74;
            const y = 52 + row * 64;
            const fill = (row + col) % 2 === 0 ? palette.accentSoft : palette.accent;
            return `<rect x="${x}" y="${y}" width="74" height="64" rx="8" fill="${fill}" opacity="0.56"/>`;
          })
          .join("")
      )
      .join("\n")}
    <path d="M206 128 C174 128 154 148 154 174 C154 194 168 210 188 216 C176 228 166 244 166 266 H246 C246 244 236 228 224 216 C244 210 258 194 258 174 C258 148 238 128 206 128 Z" fill="${palette.ink}" opacity="0.9"/>
  </g>`;
    case "compass-star":
      return `
  <g transform="translate(${404 + sx} ${556 + sy})">
    <circle cx="196" cy="172" r="144" fill="${palette.light}" stroke="${palette.accentSoft}" stroke-width="8"/>
    <circle cx="196" cy="172" r="94" fill="none" stroke="${palette.accent}" stroke-width="12" opacity="0.86"/>
    <polygon points="196,46 230,138 322,172 230,206 196,298 162,206 70,172 162,138" fill="${palette.ink}" opacity="0.88"/>
    <polygon points="196,88 214,146 272,172 214,198 196,256 178,198 120,172 178,146" fill="${palette.light}" opacity="0.92"/>
  </g>`;
    case "speech-bubbles":
      return `
  <g transform="translate(${398 + sx} ${568 + sy})">
    <rect x="22" y="32" width="238" height="156" rx="28" fill="${palette.light}" stroke="${palette.accentSoft}" stroke-width="8"/>
    <polygon points="108,188 140,188 120,220" fill="${palette.light}" stroke="${palette.accentSoft}" stroke-width="8"/>
    <rect x="166" y="128" width="218" height="162" rx="28" fill="${palette.accent}" opacity="0.84"/>
    <polygon points="302,290 336,290 318,322" fill="${palette.accent}" opacity="0.84"/>
    <rect x="62" y="82" width="160" height="14" rx="7" fill="${palette.accentSoft}" opacity="0.72"/>
    <rect x="62" y="112" width="124" height="14" rx="7" fill="${palette.accent}" opacity="0.7"/>
    <rect x="194" y="182" width="156" height="14" rx="7" fill="${palette.light}" opacity="0.78"/>
    <rect x="194" y="212" width="128" height="14" rx="7" fill="${palette.light}" opacity="0.68"/>
  </g>`;
    case "mind-network":
      return `
  <g transform="translate(${396 + sx} ${556 + sy})">
    <rect x="18" y="24" width="364" height="334" rx="26" fill="${palette.light}" stroke="${palette.accentSoft}" stroke-width="8"/>
    <g stroke="${palette.accent}" stroke-width="8" opacity="0.86">
      <line x1="84" y1="96" x2="174" y2="144"/>
      <line x1="174" y1="144" x2="282" y2="110"/>
      <line x1="174" y1="144" x2="166" y2="244"/>
      <line x1="166" y1="244" x2="280" y2="286"/>
      <line x1="84" y1="96" x2="96" y2="232"/>
      <line x1="96" y1="232" x2="166" y2="244"/>
      <line x1="282" y1="110" x2="280" y2="286"/>
    </g>
    <g fill="${palette.ink}">
      <circle cx="84" cy="96" r="14"/>
      <circle cx="174" cy="144" r="14"/>
      <circle cx="282" cy="110" r="14"/>
      <circle cx="96" cy="232" r="14"/>
      <circle cx="166" cy="244" r="14"/>
      <circle cx="280" cy="286" r="14"/>
    </g>
  </g>`;
    case "mask-dual":
      return `
  <g transform="translate(${406 + sx} ${562 + sy})">
    <path d="M82 68 H188 C216 68 238 90 238 118 V238 C238 294 194 340 136 340 C78 340 34 294 34 238 V118 C34 90 56 68 82 68 Z" fill="${palette.light}" stroke="${palette.accentSoft}" stroke-width="8"/>
    <path d="M208 68 H314 C342 68 364 90 364 118 V238 C364 294 320 340 262 340 C204 340 160 294 160 238 V118 C160 90 182 68 208 68 Z" fill="${palette.accent}" opacity="0.84"/>
    <circle cx="102" cy="182" r="10" fill="${palette.ink}"/>
    <circle cx="164" cy="182" r="10" fill="${palette.ink}"/>
    <path d="M94 242 Q132 270 172 242" fill="none" stroke="${palette.ink}" stroke-width="10" stroke-linecap="round"/>
    <circle cx="228" cy="182" r="10" fill="${palette.light}"/>
    <circle cx="290" cy="182" r="10" fill="${palette.light}"/>
    <path d="M220 250 Q258 222 298 250" fill="none" stroke="${palette.light}" stroke-width="10" stroke-linecap="round"/>
  </g>`;
    case "interlocked-rings":
      return `
  <g transform="translate(${404 + sx} ${566 + sy})">
    <circle cx="150" cy="176" r="88" fill="none" stroke="${palette.accent}" stroke-width="22"/>
    <circle cx="254" cy="176" r="88" fill="none" stroke="${palette.accentSoft}" stroke-width="22"/>
    <rect x="56" y="50" width="292" height="252" rx="26" fill="none" stroke="${palette.light}" stroke-width="8" opacity="0.78"/>
  </g>`;
    case "hourglass-track":
      return `
  <g transform="translate(${418 + sx} ${552 + sy})">
    <rect x="0" y="0" width="356" height="352" rx="24" fill="${palette.light}" stroke="${palette.accentSoft}" stroke-width="8"/>
    <path d="M88 72 H268 C264 112 236 146 200 176 C236 206 264 240 268 280 H88 C92 240 120 206 156 176 C120 146 92 112 88 72 Z" fill="${palette.accent}" opacity="0.86"/>
    <path d="M156 176 H200" stroke="${palette.ink}" stroke-width="8" stroke-linecap="round"/>
    <circle cx="178" cy="168" r="7" fill="${palette.light}"/>
    <circle cx="186" cy="186" r="6" fill="${palette.light}"/>
    <circle cx="172" cy="204" r="5" fill="${palette.light}"/>
  </g>`;
    case "crown-sigil":
      return `
  <g transform="translate(${414 + sx} ${560 + sy})">
    <rect x="30" y="44" width="332" height="292" rx="24" fill="${palette.light}" stroke="${palette.accentSoft}" stroke-width="8"/>
    <path d="M74 246 L104 118 L176 186 L222 110 L286 186 L318 118 L346 246 Z" fill="${palette.accent}" opacity="0.9"/>
    <rect x="88" y="244" width="248" height="38" rx="14" fill="${palette.ink}" opacity="0.88"/>
    <circle cx="104" cy="112" r="10" fill="${palette.ink}"/>
    <circle cx="222" cy="102" r="11" fill="${palette.ink}"/>
    <circle cx="318" cy="112" r="10" fill="${palette.ink}"/>
  </g>`;
    case "flag-peak":
      return `
  <g transform="translate(${398 + sx} ${570 + sy})">
    <rect x="0" y="0" width="404" height="312" rx="24" fill="${palette.light}" stroke="${palette.accentSoft}" stroke-width="8"/>
    <path d="M34 266 L132 144 L194 224 L278 112 L370 266 Z" fill="${palette.accent}" opacity="0.88"/>
    <path d="M118 154 V84" stroke="${palette.ink}" stroke-width="10" stroke-linecap="round"/>
    <path d="M118 86 L188 106 L118 126 Z" fill="${palette.ink}" opacity="0.9"/>
    <circle cx="320" cy="78" r="22" fill="${palette.accentSoft}" opacity="0.72"/>
  </g>`;
    case "bar-coin":
      return `
  <g transform="translate(${404 + sx} ${566 + sy})">
    <rect x="0" y="0" width="392" height="332" rx="24" fill="${palette.light}" stroke="${palette.accentSoft}" stroke-width="8"/>
    <rect x="74" y="192" width="46" height="94" rx="10" fill="${palette.accent}" opacity="0.84"/>
    <rect x="142" y="150" width="46" height="136" rx="10" fill="${palette.accentSoft}" opacity="0.86"/>
    <rect x="210" y="122" width="46" height="164" rx="10" fill="${palette.accent}" opacity="0.88"/>
    <circle cx="302" cy="188" r="58" fill="${palette.ink}" opacity="0.82"/>
    <text x="302" y="206" text-anchor="middle" fill="${palette.light}" font-family="Georgia, serif" font-size="48" font-weight="700">$</text>
  </g>`;
    case "line-chart":
      return `
  <g transform="translate(${402 + sx} ${568 + sy})">
    <rect x="0" y="0" width="396" height="324" rx="24" fill="${palette.light}" stroke="${palette.accentSoft}" stroke-width="8"/>
    <line x1="62" y1="272" x2="334" y2="272" stroke="${palette.accentSoft}" stroke-width="10" stroke-linecap="round"/>
    <line x1="62" y1="272" x2="62" y2="74" stroke="${palette.accentSoft}" stroke-width="10" stroke-linecap="round"/>
    <path d="M78 236 L144 210 L194 226 L248 154 L318 122" fill="none" stroke="${palette.accent}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="318" cy="122" r="12" fill="${palette.ink}"/>
  </g>`;
    case "open-book":
      return `
  <g transform="translate(${398 + sx} ${566 + sy})">
    <path d="M40 74 C126 44 198 70 198 128 V304 C146 270 94 262 40 292 Z" fill="${palette.light}" stroke="${palette.accentSoft}" stroke-width="8"/>
    <path d="M356 74 C270 44 198 70 198 128 V304 C250 270 302 262 356 292 Z" fill="${palette.accent}" opacity="0.84"/>
    <path d="M198 128 V316" stroke="${palette.ink}" stroke-width="10" stroke-linecap="round"/>
    <path d="M74 120 C118 106 156 110 186 132" stroke="${palette.accent}" stroke-width="8" stroke-linecap="round"/>
    <path d="M320 120 C278 106 240 110 210 132" stroke="${palette.light}" stroke-width="8" stroke-linecap="round"/>
  </g>`;
    case "node-map":
      return `
  <g transform="translate(${404 + sx} ${562 + sy})">
    <rect x="14" y="24" width="368" height="332" rx="24" fill="${palette.light}" stroke="${palette.accentSoft}" stroke-width="8"/>
    <g stroke="${palette.accent}" stroke-width="8" opacity="0.86">
      <line x1="94" y1="96" x2="184" y2="140"/>
      <line x1="184" y1="140" x2="288" y2="108"/>
      <line x1="184" y1="140" x2="174" y2="242"/>
      <line x1="174" y1="242" x2="286" y2="284"/>
      <line x1="94" y1="96" x2="104" y2="228"/>
      <line x1="104" y1="228" x2="174" y2="242"/>
      <line x1="288" y1="108" x2="286" y2="284"/>
    </g>
    <g fill="${palette.ink}">
      <circle cx="94" cy="96" r="13"/>
      <circle cx="184" cy="140" r="13"/>
      <circle cx="288" cy="108" r="13"/>
      <circle cx="104" cy="228" r="13"/>
      <circle cx="174" cy="242" r="13"/>
      <circle cx="286" cy="284" r="13"/>
    </g>
  </g>`;
    case "column-arch":
      return `
  <g transform="translate(${406 + sx} ${558 + sy})">
    <rect x="42" y="56" width="58" height="250" rx="8" fill="${palette.accent}" opacity="0.84"/>
    <rect x="294" y="56" width="58" height="250" rx="8" fill="${palette.accent}" opacity="0.84"/>
    <path d="M100 90 C136 40 258 40 294 90 V132 H100 Z" fill="${palette.light}" stroke="${palette.accentSoft}" stroke-width="8"/>
    <rect x="126" y="132" width="168" height="174" rx="14" fill="${palette.light}" stroke="${palette.accentSoft}" stroke-width="8"/>
    <line x1="100" y1="198" x2="294" y2="198" stroke="${palette.accentSoft}" stroke-width="8"/>
  </g>`;
    case "scale-balance":
      return `
  <g transform="translate(${410 + sx} ${560 + sy})">
    <line x1="186" y1="64" x2="186" y2="318" stroke="${palette.ink}" stroke-width="12" stroke-linecap="round"/>
    <line x1="88" y1="114" x2="284" y2="114" stroke="${palette.ink}" stroke-width="12" stroke-linecap="round"/>
    <path d="M114 114 L84 184 H144 Z" fill="${palette.accent}" opacity="0.86"/>
    <path d="M258 114 L228 184 H288 Z" fill="${palette.accentSoft}" opacity="0.9"/>
    <rect x="126" y="318" width="120" height="18" rx="9" fill="${palette.ink}" opacity="0.88"/>
    <circle cx="186" cy="74" r="20" fill="${palette.light}" stroke="${palette.accentSoft}" stroke-width="8"/>
  </g>`;
    case "mountain-sun":
      return `
  <g transform="translate(${396 + sx} ${564 + sy})">
    <circle cx="204" cy="72" r="44" fill="${palette.accent}" opacity="0.44"/>
    <path d="M24 292 L132 144 L208 248 L296 114 L388 292 Z" fill="${palette.accentSoft}" opacity="0.82"/>
    <path d="M84 292 L168 186 L226 260 L302 172 L360 292 Z" fill="${palette.accent}" opacity="0.82"/>
    <path d="M34 292 H378" stroke="${palette.light}" stroke-width="12" stroke-linecap="round" opacity="0.8"/>
  </g>`;
    case "bridge-arc":
      return `
  <g transform="translate(${396 + sx} ${574 + sy})">
    <rect x="0" y="0" width="408" height="304" rx="24" fill="${palette.light}" stroke="${palette.accentSoft}" stroke-width="8"/>
    <path d="M50 242 Q204 92 358 242" fill="none" stroke="${palette.accent}" stroke-width="16" stroke-linecap="round"/>
    <line x1="98" y1="214" x2="98" y2="242" stroke="${palette.accentSoft}" stroke-width="10" stroke-linecap="round"/>
    <line x1="146" y1="174" x2="146" y2="242" stroke="${palette.accentSoft}" stroke-width="10" stroke-linecap="round"/>
    <line x1="204" y1="150" x2="204" y2="242" stroke="${palette.accentSoft}" stroke-width="10" stroke-linecap="round"/>
    <line x1="262" y1="174" x2="262" y2="242" stroke="${palette.accentSoft}" stroke-width="10" stroke-linecap="round"/>
    <line x1="310" y1="214" x2="310" y2="242" stroke="${palette.accentSoft}" stroke-width="10" stroke-linecap="round"/>
  </g>`;
    case "heart-link":
      return `
  <g transform="translate(${410 + sx} ${564 + sy})">
    <path d="M196 304 C128 250 64 202 64 140 C64 96 96 66 138 66 C166 66 186 78 196 98 C206 78 226 66 254 66 C296 66 328 96 328 140 C328 202 264 250 196 304 Z" fill="${palette.accent}" opacity="0.84"/>
    <path d="M146 182 L182 220 L250 148" fill="none" stroke="${palette.light}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="104" cy="236" r="16" fill="${palette.accentSoft}" opacity="0.9"/>
    <circle cx="286" cy="236" r="16" fill="${palette.accentSoft}" opacity="0.9"/>
  </g>`;
    case "rocket":
      return `
  <g transform="translate(${408 + sx} ${552 + sy})">
    <path d="M198 24 C272 78 304 152 304 220 C304 292 254 342 198 374 C142 342 92 292 92 220 C92 152 124 78 198 24 Z" fill="${palette.accent}" opacity="0.9"/>
    <circle cx="198" cy="162" r="44" fill="${palette.light}" opacity="0.95"/>
    <path d="M176 226 L220 226 L236 322 L160 322 Z" fill="${palette.light}" opacity="0.94"/>
    <path d="M108 272 L58 304 L102 316 Z" fill="${palette.accentSoft}" opacity="0.9"/>
    <path d="M288 272 L338 304 L294 316 Z" fill="${palette.accentSoft}" opacity="0.9"/>
  </g>`;
    case "maze-grid":
      return `
  <g transform="translate(${406 + sx} ${564 + sy})">
    <rect x="0" y="0" width="388" height="332" rx="24" fill="${palette.light}" stroke="${palette.accentSoft}" stroke-width="8"/>
    <path d="M52 62 H338 V270 H82 V100 H286 V228 H136 V152 H236" fill="none" stroke="${palette.accent}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="236" cy="152" r="12" fill="${palette.ink}"/>
  </g>`;
    case "anvil-mark":
      return `
  <g transform="translate(${410 + sx} ${572 + sy})">
    <path d="M54 194 H254 C278 194 298 174 298 150 H180 C150 150 126 126 126 96 H294 C326 96 352 122 352 154 C352 226 298 278 228 278 H166 L154 318 H76 Z" fill="${palette.accent}" opacity="0.88"/>
    <rect x="120" y="278" width="154" height="28" rx="12" fill="${palette.ink}" opacity="0.86"/>
    <rect x="146" y="244" width="110" height="22" rx="10" fill="${palette.light}" opacity="0.82"/>
  </g>`;
    case "focus-block":
      return `
  <g transform="translate(${410 + sx} ${560 + sy})">
    <rect x="0" y="0" width="380" height="332" rx="20" fill="${palette.light}" stroke="${palette.accentSoft}" stroke-width="8"/>
    <rect x="62" y="64" width="256" height="188" rx="14" fill="${palette.ink}" opacity="0.9"/>
    <rect x="92" y="278" width="196" height="20" rx="10" fill="${palette.accent}" opacity="0.86"/>
  </g>`;
    case "dot-grid":
      return `
  <g transform="translate(${404 + sx} ${556 + sy})">
    <rect x="0" y="0" width="392" height="340" rx="24" fill="${palette.light}" stroke="${palette.accentSoft}" stroke-width="8"/>
    ${Array.from({ length: 5 })
      .map((_row, r) =>
        Array.from({ length: 5 })
          .map((_col, c) => {
            const cx = 72 + c * 62;
            const cy = 70 + r * 56;
            const fill = (r + c) % 2 === 0 ? palette.accent : palette.accentSoft;
            return `<circle cx="${cx}" cy="${cy}" r="13" fill="${fill}" opacity="0.88"/>`;
          })
          .join("")
      )
      .join("\n")}
  </g>`;
    case "checklist-board":
      return `
  <g transform="translate(${404 + sx} ${560 + sy})">
    <rect x="0" y="0" width="392" height="332" rx="24" fill="${palette.light}" stroke="${palette.accentSoft}" stroke-width="8"/>
    <rect x="54" y="58" width="282" height="224" rx="18" fill="${palette.accent}" opacity="0.16"/>
    <rect x="82" y="92" width="24" height="24" rx="6" fill="${palette.accentSoft}" opacity="0.86"/>
    <path d="M86 104 L92 110 L104 96" fill="none" stroke="${palette.ink}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="120" y="96" width="186" height="14" rx="7" fill="${palette.accent}" opacity="0.82"/>
    <rect x="82" y="144" width="24" height="24" rx="6" fill="${palette.accentSoft}" opacity="0.86"/>
    <path d="M86 156 L92 162 L104 148" fill="none" stroke="${palette.ink}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="120" y="148" width="164" height="14" rx="7" fill="${palette.accent}" opacity="0.78"/>
    <rect x="82" y="196" width="24" height="24" rx="6" fill="${palette.accentSoft}" opacity="0.86"/>
    <path d="M86 208 L92 214 L104 200" fill="none" stroke="${palette.ink}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="120" y="200" width="206" height="14" rx="7" fill="${palette.accent}" opacity="0.74"/>
  </g>`;
    case "pencil-line":
      return `
  <g transform="translate(${390 + sx} ${566 + sy})">
    <rect x="0" y="0" width="420" height="328" rx="24" fill="${palette.light}" stroke="${palette.accentSoft}" stroke-width="8"/>
    <path d="M56 258 C136 192 228 222 306 158" stroke="${palette.ink}" stroke-width="10" stroke-linecap="round"/>
    <rect x="82" y="98" width="250" height="26" rx="13" fill="${palette.accentSoft}" opacity="0.55"/>
    <rect x="82" y="132" width="212" height="26" rx="13" fill="${palette.accent}" opacity="0.45"/>
    <g transform="translate(294 214) rotate(-18)">
      <rect x="0" y="0" width="88" height="22" rx="10" fill="${palette.accent}" opacity="0.9"/>
      <polygon points="88,11 108,0 108,22" fill="${palette.ink}"/>
      <polygon points="108,0 118,11 108,22" fill="${palette.light}"/>
    </g>
  </g>`;
    case "loop-arrows":
      return `
  <g transform="translate(${404 + sx} ${558 + sy})">
    <circle cx="196" cy="170" r="128" fill="none" stroke="${palette.accent}" stroke-width="20" opacity="0.88"/>
    <circle cx="196" cy="170" r="76" fill="none" stroke="${palette.accentSoft}" stroke-width="18" opacity="0.86"/>
    <polygon points="316,170 274,154 284,186" fill="${palette.accent}"/>
    <polygon points="118,96 132,136 98,126" fill="${palette.accentSoft}"/>
    <circle cx="196" cy="170" r="32" fill="${palette.ink}" opacity="0.82"/>
  </g>`;
    case "bullet-dot":
      return `
  <g transform="translate(${430 + sx} ${590 + sy})">
    <rect x="0" y="0" width="340" height="276" rx="22" fill="${palette.light}" stroke="${palette.accentSoft}" stroke-width="8"/>
    <circle cx="170" cy="130" r="68" fill="${palette.ink}" opacity="0.92"/>
    <rect x="84" y="214" width="172" height="20" rx="10" fill="${palette.accent}" opacity="0.88"/>
  </g>`;
    case "target-rings":
      return `
  <g transform="translate(${404 + sx} ${552 + sy})">
    <circle cx="196" cy="186" r="152" fill="${palette.light}" opacity="0.95" stroke="${palette.accentSoft}" stroke-width="8"/>
    <circle cx="196" cy="186" r="104" fill="none" stroke="${palette.accent}" stroke-width="16"/>
    <circle cx="196" cy="186" r="62" fill="none" stroke="${palette.accentSoft}" stroke-width="14"/>
    <circle cx="196" cy="186" r="24" fill="${palette.ink}"/>
  </g>`;
    case "crossed-swords":
      return `
  <g transform="translate(${404 + sx} ${548 + sy})">
    <rect x="38" y="28" width="320" height="300" rx="24" fill="${palette.light}" stroke="${palette.accentSoft}" stroke-width="8"/>
    <path d="M86 288 L302 72" stroke="${palette.accent}" stroke-width="16" stroke-linecap="round"/>
    <path d="M302 288 L86 72" stroke="${palette.accentSoft}" stroke-width="16" stroke-linecap="round"/>
    <rect x="74" y="278" width="34" height="12" rx="6" fill="${palette.ink}"/>
    <rect x="292" y="278" width="34" height="12" rx="6" fill="${palette.ink}"/>
  </g>`;
    case "handshake-split":
      return `
  <g transform="translate(${402 + sx} ${560 + sy})">
    <rect x="0" y="0" width="396" height="332" rx="24" fill="${palette.light}" stroke="${palette.accentSoft}" stroke-width="8"/>
    <rect x="194" y="40" width="8" height="252" rx="4" fill="${palette.accent}" opacity="0.84"/>
    <path d="M68 204 Q120 152 178 190 L194 206" fill="none" stroke="${palette.ink}" stroke-width="14" stroke-linecap="round"/>
    <path d="M328 204 Q276 152 218 190 L202 206" fill="none" stroke="${palette.ink}" stroke-width="14" stroke-linecap="round"/>
    <rect x="86" y="90" width="94" height="22" rx="11" fill="${palette.accentSoft}" opacity="0.72"/>
    <rect x="214" y="90" width="96" height="22" rx="11" fill="${palette.accent}" opacity="0.72"/>
  </g>`;
    case "magnet-u":
      return `
  <g transform="translate(${408 + sx} ${562 + sy})">
    <path d="M80 68 V214 Q80 304 170 304 H230 Q320 304 320 214 V68" fill="none" stroke="${palette.accent}" stroke-width="34" stroke-linecap="round"/>
    <rect x="66" y="40" width="44" height="68" rx="12" fill="${palette.light}"/>
    <rect x="290" y="40" width="44" height="68" rx="12" fill="${palette.light}"/>
    <circle cx="198" cy="182" r="54" fill="${palette.accentSoft}" opacity="0.7"/>
    <circle cx="198" cy="182" r="26" fill="${palette.ink}" opacity="0.86"/>
  </g>`;
    case "microphone":
      return `
  <g transform="translate(${426 + sx} ${556 + sy})">
    <rect x="96" y="18" width="146" height="186" rx="72" fill="${palette.accent}" opacity="0.9"/>
    <rect x="116" y="42" width="106" height="138" rx="52" fill="${palette.light}" opacity="0.9"/>
    <path d="M64 174 Q64 248 132 268 H206 Q274 248 274 174" fill="none" stroke="${palette.ink}" stroke-width="12" stroke-linecap="round"/>
    <rect x="164" y="264" width="16" height="68" rx="8" fill="${palette.ink}"/>
    <rect x="122" y="330" width="100" height="16" rx="8" fill="${palette.ink}"/>
  </g>`;
    case "wave-surge":
      return `
  <g transform="translate(${392 + sx} ${574 + sy})">
    <rect x="0" y="0" width="416" height="308" rx="24" fill="${palette.light}" stroke="${palette.accentSoft}" stroke-width="8"/>
    <path d="M20 198 C86 132 148 132 214 198 C278 262 340 262 396 198" fill="none" stroke="${palette.accent}" stroke-width="16" stroke-linecap="round"/>
    <path d="M20 242 C88 176 150 176 216 242 C278 304 340 304 396 242" fill="none" stroke="${palette.accentSoft}" stroke-width="14" stroke-linecap="round"/>
  </g>`;
    case "swan-curve":
      return `
  <g transform="translate(${400 + sx} ${564 + sy})">
    <rect x="0" y="0" width="400" height="324" rx="24" fill="${palette.light}" stroke="${palette.accentSoft}" stroke-width="8"/>
    <path d="M98 232 C122 166 196 142 236 178 C264 204 246 248 202 256 C180 260 158 254 138 236 C170 274 232 284 278 246 C324 208 320 138 266 104 C226 80 176 84 138 112" fill="none" stroke="${palette.ink}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="252" cy="122" r="8" fill="${palette.ink}"/>
  </g>`;
    case "flywheel":
      return `
  <g transform="translate(${400 + sx} ${554 + sy})">
    <circle cx="200" cy="188" r="146" fill="${palette.light}" opacity="0.95" stroke="${palette.accentSoft}" stroke-width="8"/>
    <circle cx="200" cy="188" r="104" fill="none" stroke="${palette.accent}" stroke-width="18" opacity="0.86"/>
    <circle cx="200" cy="188" r="56" fill="none" stroke="${palette.accentSoft}" stroke-width="14" opacity="0.86"/>
    <path d="M306 168 L332 200 L292 204" fill="${palette.accent}"/>
  </g>`;
    case "zero-one":
      return `
  <g transform="translate(${406 + sx} ${566 + sy})">
    <rect x="0" y="0" width="388" height="334" rx="24" fill="${palette.light}" stroke="${palette.accentSoft}" stroke-width="8"/>
    <text x="104" y="204" text-anchor="middle" fill="${palette.ink}" font-family="Georgia, serif" font-size="150" font-weight="700">0</text>
    <text x="292" y="204" text-anchor="middle" fill="${palette.accent}" font-family="Georgia, serif" font-size="150" font-weight="700">1</text>
    <path d="M166 176 L222 176" stroke="${palette.accentSoft}" stroke-width="14" stroke-linecap="round"/>
  </g>`;
    case "stacked-coins":
      return `
  <g transform="translate(${408 + sx} ${566 + sy})">
    <ellipse cx="198" cy="286" rx="144" ry="34" fill="${palette.accentSoft}" opacity="0.72"/>
    <ellipse cx="198" cy="248" rx="144" ry="34" fill="${palette.accent}" opacity="0.8"/>
    <ellipse cx="198" cy="210" rx="144" ry="34" fill="${palette.accentSoft}" opacity="0.86"/>
    <ellipse cx="198" cy="172" rx="144" ry="34" fill="${palette.accent}" opacity="0.92"/>
    <circle cx="198" cy="100" r="44" fill="${palette.ink}" opacity="0.85"/>
    <text x="198" y="114" text-anchor="middle" fill="${palette.light}" font-family="Georgia, serif" font-size="40" font-weight="700">$</text>
  </g>`;
    case "shield-mark":
      return `
  <g transform="translate(${414 + sx} ${552 + sy})">
    <path d="M182 26 L326 84 V192 C326 286 262 350 182 384 C102 350 38 286 38 192 V84 Z" fill="${palette.accent}" opacity="0.88"/>
    <path d="M182 70 L286 112 V192 C286 260 244 310 182 340 C120 310 78 260 78 192 V112 Z" fill="${palette.light}" opacity="0.9"/>
    <path d="M132 198 L166 232 L236 160" fill="none" stroke="${palette.ink}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
  </g>`;
    case "pyramid":
      return `
  <g transform="translate(${408 + sx} ${560 + sy})">
    <polygon points="198,34 344,304 52,304" fill="${palette.accent}" opacity="0.9"/>
    <polygon points="198,74 304,272 92,272" fill="${palette.light}" opacity="0.88"/>
    <line x1="198" y1="74" x2="198" y2="272" stroke="${palette.accentSoft}" stroke-width="10"/>
    <line x1="144" y1="174" x2="252" y2="174" stroke="${palette.accentSoft}" stroke-width="10"/>
  </g>`;
    default:
      return renderThemeSymbol(theme, palette, seed);
  }
}

function titleInitials(title) {
  const words = cleanSpaces(title)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !STOP_WORDS.has(word));
  if (words.length === 0) return "BK";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function renderCoverSigil(book, palette, seed) {
  const initials = titleInitials(book.title);
  const variant = seed % 6;

  switch (variant) {
    case 0:
      return `
  <g transform="translate(928 336)">
    <circle cx="84" cy="84" r="76" fill="${palette.light}" stroke="${palette.accent}" stroke-width="10"/>
    <circle cx="84" cy="84" r="56" fill="${palette.accentSoft}" opacity="0.68"/>
    <text x="84" y="98" text-anchor="middle" fill="${palette.ink}" font-family="'Trebuchet MS', Arial, sans-serif" font-size="44" font-weight="700" letter-spacing="2">${esc(initials)}</text>
  </g>`;
    case 1:
      return `
  <g transform="translate(922 332)">
    <rect x="12" y="12" width="152" height="152" rx="24" fill="${palette.light}" stroke="${palette.accent}" stroke-width="10"/>
    <path d="M30 116 L146 52" stroke="${palette.accentSoft}" stroke-width="8" stroke-linecap="round"/>
    <path d="M30 138 L146 74" stroke="${palette.accentSoft}" stroke-width="8" stroke-linecap="round"/>
    <text x="88" y="102" text-anchor="middle" fill="${palette.ink}" font-family="'Trebuchet MS', Arial, sans-serif" font-size="44" font-weight="700" letter-spacing="2">${esc(initials)}</text>
  </g>`;
    case 2:
      return `
  <g transform="translate(926 334)">
    <polygon points="88,8 162,52 162,136 88,180 14,136 14,52" fill="${palette.light}" stroke="${palette.accent}" stroke-width="10"/>
    <circle cx="88" cy="94" r="44" fill="${palette.accentSoft}" opacity="0.7"/>
    <text x="88" y="108" text-anchor="middle" fill="${palette.ink}" font-family="'Trebuchet MS', Arial, sans-serif" font-size="42" font-weight="700" letter-spacing="2">${esc(initials)}</text>
  </g>`;
    case 3:
      return `
  <g transform="translate(930 336)">
    <path d="M82 8 L152 34 V90 C152 142 120 174 82 190 C44 174 12 142 12 90 V34 Z" fill="${palette.light}" stroke="${palette.accent}" stroke-width="10"/>
    <rect x="30" y="64" width="104" height="64" rx="20" fill="${palette.accentSoft}" opacity="0.72"/>
    <text x="82" y="106" text-anchor="middle" fill="${palette.ink}" font-family="'Trebuchet MS', Arial, sans-serif" font-size="40" font-weight="700" letter-spacing="2">${esc(initials)}</text>
  </g>`;
    case 4:
      return `
  <g transform="translate(924 332)">
    <rect x="24" y="14" width="128" height="156" rx="64" fill="${palette.light}" stroke="${palette.accent}" stroke-width="10"/>
    <path d="M44 54 H132" stroke="${palette.accentSoft}" stroke-width="10" stroke-linecap="round"/>
    <path d="M44 80 H132" stroke="${palette.accentSoft}" stroke-width="10" stroke-linecap="round"/>
    <text x="88" y="128" text-anchor="middle" fill="${palette.ink}" font-family="'Trebuchet MS', Arial, sans-serif" font-size="42" font-weight="700" letter-spacing="2">${esc(initials)}</text>
  </g>`;
    case 5:
    default:
      return `
  <g transform="translate(924 332)">
    <polygon points="88,8 168,88 88,168 8,88" fill="${palette.light}" stroke="${palette.accent}" stroke-width="10"/>
    <circle cx="88" cy="88" r="38" fill="${palette.accentSoft}" opacity="0.72"/>
    <text x="88" y="102" text-anchor="middle" fill="${palette.ink}" font-family="'Trebuchet MS', Arial, sans-serif" font-size="40" font-weight="700" letter-spacing="2">${esc(initials)}</text>
  </g>`;
  }
}

function createCoverSvg(pkg) {
  const id = pkg.book.bookId;
  const override = COVER_BOOK_OVERRIDES[id] || null;
  const theme = override?.theme || chooseCoverTheme(pkg.book);
  const meta = COVER_THEME_META[theme] || COVER_THEME_META.thinking;
  const seed = hash(`${id}|${pkg.book.author}|${pkg.book.title}|${theme}`);
  const motif = chooseCoverMotif(pkg.book, theme, id);
  const basePalette = meta.palettes[hash(`${id}|${theme}`) % meta.palettes.length];
  const palette = { ...basePalette, ...(COVER_PALETTE_OVERRIDES[id] || {}) };
  const layoutVariant = hash(`${pkg.book.title}|${pkg.book.author}`) % 5;
  const gradId = `g${hash(`${id}-${theme}`)}`;
  const author = cleanSpaces(pkg.book.author).toUpperCase();
  const titleLines = splitTitle(pkg.book.title);
  const fontSize = titleFontSize(titleLines);
  const keywordText = keywordLine(pkg.book, meta.label);
  const subtitle = override?.subtitle || meta.subtitle;
  const sigilSvg = renderCoverSigil(pkg.book, palette, seed);
  const lineGap = Math.round(fontSize * 1.08);
  const firstLineY = titleLines.length === 1 ? 1216 : titleLines.length === 2 ? 1162 : 1114;
  const titleSvg = titleLines
    .map((line, index) => {
      const y = firstLineY + index * lineGap;
      return `  <text x="600" y="${y}" text-anchor="middle" fill="${palette.ink}" font-family="${meta.titleFont}" font-size="${fontSize}" font-weight="700" letter-spacing="2">${esc(line)}</text>`;
    })
    .join("\n");

  return `<svg width="1200" height="1800" viewBox="0 0 1200 1800" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">${esc(pkg.book.title)} cover</title>
  <desc id="desc">Auto-generated themed cover for ${esc(pkg.book.title)} by ${esc(pkg.book.author)}.</desc>
  <defs>
    <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1800" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${palette.bgTop}"/>
      <stop offset="100%" stop-color="${palette.bgBottom}"/>
    </linearGradient>
  </defs>

  <rect width="1200" height="1800" fill="url(#${gradId})"/>
${renderCoverLayout(layoutVariant, palette, seed)}
  <rect x="116" y="304" width="968" height="1036" rx="38" fill="${palette.panel}" stroke="${palette.panelStroke}" stroke-width="10"/>
${renderCoverMotif(motif, theme, palette, seed)}
${sigilSvg}

  <rect x="0" y="0" width="1200" height="238" fill="${palette.bgTop}" opacity="0.93"/>
  <rect x="0" y="1454" width="1200" height="346" fill="${palette.bgBottom}" opacity="0.95"/>
  <text x="600" y="136" text-anchor="middle" fill="${palette.light}" font-family="Georgia, serif" font-size="62" font-weight="700" letter-spacing="3">${esc(author)}</text>
  <text x="600" y="208" text-anchor="middle" fill="${palette.light}" font-family="'Trebuchet MS', Arial, sans-serif" font-size="30" letter-spacing="4">${esc(meta.label)}</text>
${titleSvg}
  <text x="600" y="1538" text-anchor="middle" fill="${palette.light}" font-family="'Trebuchet MS', Arial, sans-serif" font-size="30" letter-spacing="3">${esc(keywordText)}</text>
  <text x="600" y="1604" text-anchor="middle" fill="${palette.light}" font-family="Georgia, serif" font-size="30">${esc(subtitle)}</text>
  <text x="600" y="1668" text-anchor="middle" fill="${palette.light}" font-family="'Trebuchet MS', Arial, sans-serif" font-size="26" letter-spacing="2">Modern Edition · Practical Lessons · Real Scenarios</text>
</svg>
`;
}

function hasCover(bookId) {
  return COVER_EXTS.some((ext) => fs.existsSync(path.join(BOOK_COVERS_DIR, `${bookId}${ext}`)));
}

function polishPackageFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const pkg = JSON.parse(raw);
  let touched = false;
  let chapterFixes = 0;
  let exampleFixes = 0;
  let questionFixes = 0;

  for (const chapter of pkg.chapters || []) {
    const anchor = chooseAnchor(chapter);

    if (Array.isArray(chapter.examples)) {
      for (const example of chapter.examples) {
        const original = JSON.stringify(example);
        const leadName = extractLeadName(example.scenario || "");

        example.scenario = polishText(fixNameVerbAgreement(example.scenario || "", leadName));
        example.whatToDo = (example.whatToDo || []).map((step) => polishText(fixNameVerbAgreement(step, leadName)));
        example.whyItMatters = polishText(fixNameVerbAgreement(example.whyItMatters || "", leadName));
        example.contexts = normalizeContexts(example.contexts);

        const relevant = hasChapterRelevance(chapter, [
          example.scenario,
          ...(example.whatToDo || []),
          example.whyItMatters || "",
        ]);
        if (!relevant) {
          example.whyItMatters = polishText(
            `${example.whyItMatters} This scenario is directly connected to ${cleanSpaces(chapter.title).toLowerCase()}.`
          );
        }

        if (JSON.stringify(example) !== original) {
          touched = true;
          exampleFixes += 1;
        }
      }
    }

    const processQuestions = (questions, retry = false) => {
      if (!Array.isArray(questions)) return;
      questions.forEach((question, index) => {
        const before = JSON.stringify(question);
        question.prompt = buildPrompt(chapter.title, anchor, index, retry);
        question.choices = (question.choices || []).map((choice) => polishChoice(choice));
        if (!Number.isInteger(question.correctIndex)) {
          question.correctIndex = 0;
        }
        question.correctIndex = Math.max(
          0,
          Math.min(question.correctIndex, Math.max(0, (question.choices?.length || 1) - 1))
        );
        if (JSON.stringify(question) !== before) {
          touched = true;
          questionFixes += 1;
        }
      });
    };

    processQuestions(chapter.quiz?.questions, false);
    processQuestions(chapter.quiz?.retryQuestions, true);

    chapterFixes += 1;
  }

  if (touched) {
    fs.writeFileSync(filePath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  }

  return {
    touched,
    chapterFixes,
    exampleFixes,
    questionFixes,
    package: pkg,
  };
}

function main() {
  const files = fs
    .readdirSync(BOOK_PACKAGES_DIR)
    .filter((name) => name.endsWith(".json"))
    .map((name) => path.join(BOOK_PACKAGES_DIR, name));

  let touchedBooks = 0;
  let touchedExamples = 0;
  let touchedQuestions = 0;
  let coversGenerated = 0;

  for (const filePath of files) {
    const result = polishPackageFile(filePath);
    if (result.touched) {
      touchedBooks += 1;
      touchedExamples += result.exampleFixes;
      touchedQuestions += result.questionFixes;
    }

    const bookId = result.package?.book?.bookId;
    if (bookId && (FORCE_REGEN_COVERS || !hasCover(bookId))) {
      fs.writeFileSync(
        path.join(BOOK_COVERS_DIR, `${bookId}.svg`),
        createCoverSvg(result.package),
        "utf8"
      );
      coversGenerated += 1;
    }
  }

  const missingCoverIds = [];
  for (const filePath of files) {
    const pkg = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (!hasCover(pkg.book.bookId)) {
      missingCoverIds.push(pkg.book.bookId);
    }
  }

  console.log(
    JSON.stringify(
      {
        scannedBooks: files.length,
        touchedBooks,
        touchedExamples,
        touchedQuestions,
        coversGenerated,
        missingCovers: missingCoverIds.length,
        missingCoverIds,
      },
      null,
      2
    )
  );
}

main();
