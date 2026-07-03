/**
 * Scene-concreteness critic (C26) — an example scene must be staged in a lived
 * human moment, not on an abstract system surface.
 *
 * THE DEFECT (reverted tiny-habits regen, ch4 — the "Facebook reactivation
 * email" chapter). Every example scenario is staged ON a UI/process surface and
 * the system is the protagonist:
 *   "Her email prompt says, Come back and get involved, with a green sign-in
 *    button below it."
 *   "Olivia studies the 3 prompt types on the worksheet… The green sign-in
 *    button lowers effort."
 *   "Phoebe gets the review screen in her inbox for the BJ-Demo account… the
 *    green sign-in button is doing real work."
 * There is a named person, but no clock-time, no place, no physical object, no
 * body, no sensory beat — the lesson plays out across a form/email/button. The
 * reader is shown a process, not a moment.
 *
 * THE CLEAN BOOKS stage every scene in a lived moment. Daring Greatly and Start
 * With Why anchor each scenario with a clock time ("7:15 p.m."), a named place
 * ("a Houston school auditorium"), a physical object ("a walnut desk", "spilled
 * soup", "a kitchen table"), a body ("her hand is hovering", "his feet touch the
 * floor"). Several of those scenes ALSO touch a screen / dashboard / email — but
 * the screen is one prop inside a grounded scene, never the whole stage.
 *
 * THE DISCRIMINATOR. C26 fires only when BOTH hold:
 *   (1) the scenario's stage is an abstract system — ≥2 distinct UI / form /
 *       process-surface tokens (button, sign-in, email, screen, inbox, form,
 *       dashboard, worksheet, …), AND
 *   (2) the scenario carries ZERO concrete grounding — no clock-time, day, year,
 *       named physical place (locative + proper noun), physical object/material,
 *       body part, or sensory beat.
 * Condition (2) is what makes this gold-safe: the reference scenes are saturated
 * with grounding, so a screen/email appearing in them never trips C26. The
 * purely-digital regen scenes have NO grounding, so they do. A grounded MODERN
 * digital scene (the phone-notification / group-chat venues STEP-2 R6 actively
 * encourages) is also safe — it carries a clock, a place, a body, or a sound.
 *
 * SEVERITY: MINOR (advisory). This is a STRENGTHEN signal that surfaces as QC
 * debt; the gating judgment on example concreteness stays with the semantic
 * `example_coherence` bar axis. C2 (checkSpecificScene) remains the binary
 * anchor-presence gate; C26 is the orthogonal density signal it does not have.
 * High false-positive risk (every clean book touches a screen somewhere), so the
 * test pins ZERO findings on the gold corpus — see tests/scene-concreteness.test.ts.
 */

import { ChapterV21, CriticFinding } from "../types.js";
import { finding, truncate, allTones } from "./shared.js";

// ── (1) Abstract-system stage tokens ─────────────────────────────────────────
// UI affordances, form/document surfaces, and digital-process nouns. A scene
// built on ≥2 DISTINCT keys here is staged on a system rather than in a place.
// Each entry is a distinct "key" so "email"+"email prompt" counts once, while
// "email"+"button" counts twice. These deliberately OVERLAP C2's concrete-object
// list (email/inbox/dashboard/form) — there those are concrete props; here they
// are the abstract stage, and condition (2) keeps the two readings apart.
const SYSTEM_TOKENS: Array<{ key: string; re: RegExp }> = [
  { key: "button", re: /\bbuttons?\b/i },
  { key: "sign-in", re: /\bsign[-\s]?in\b|\bsign\s+into\b|\bsigning\s+in\b/i },
  { key: "login", re: /\blog[-\s]?in\b|\blogin\b|\blogging\s+in\b/i },
  { key: "email", re: /\be-?mails?\b/i },
  { key: "screen", re: /\bscreens?\b/i },
  { key: "inbox", re: /\binbox(?:es)?\b/i },
  { key: "dashboard", re: /\bdashboards?\b/i },
  { key: "spreadsheet", re: /\bspreadsheets?\b/i },
  { key: "worksheet", re: /\bworksheets?\b/i },
  { key: "chart", re: /\bcharts?\b/i },
  { key: "form", re: /\bforms?\b/i },
  { key: "draft", re: /\bdrafts?\b/i },
  { key: "account", re: /\baccounts?\b/i },
  { key: "profile", re: /\bprofiles?\b/i },
  { key: "notification", re: /\bnotifications?\b/i },
  { key: "calendar", re: /\bcalendars?\b/i },
  { key: "app", re: /\bapps?\b/i },
  { key: "settings", re: /\bsettings\b/i },
  { key: "menu", re: /\bmenus?\b/i },
  { key: "dropdown", re: /\bdrop[-\s]?downs?\b/i },
  { key: "checkbox", re: /\bcheck[-\s]?box(?:es)?\b/i },
  { key: "toggle", re: /\btoggles?\b/i },
  { key: "popup", re: /\bpop[-\s]?ups?\b/i },
  { key: "banner", re: /\bbanners?\b/i },
  { key: "webpage", re: /\bweb\s?page\b|\bwebsite\b|\bhome\s?page\b|\blanding\s+page\b/i },
  { key: "password", re: /\bpasswords?\b/i },
  { key: "username", re: /\busernames?\b/i },
];

// ── (2) Concrete-grounding signals ───────────────────────────────────────────
// A scene that carries ANY of these is grounded in a lived moment, so C26 cannot
// fire on it — this is the gold-corpus false-positive guard. Generous by design:
// more grounding vocabulary means fewer false positives, and it cannot suppress a
// true positive because the purely-digital regen scenes match NONE of it.

const CLOCK_RE = /\b\d{1,2}:\d{2}\b|\b\d{1,2}\s?(?:a\.m\.|p\.m\.|am|pm)\b/i;
const DAY_RE = /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekend|weekday)\b/i;
// "May" is omitted deliberately: the bare modal verb "may" ("the user may know")
// is far more common in prose than the month and would falsely ground a scene. A
// real May date almost always carries a clock/day/year that grounds it anyway.
const MONTH_RE = /\b(?:january|february|march|april|june|july|august|september|october|november|december)\b/i;
const YEAR_RE = /\b(?:18|19|20)\d{2}\b/;
// Time-of-day anchors a scene in a moment as firmly as a clock does.
const TIME_OF_DAY_RE =
  /\b(?:dawn|daybreak|sunrise|morning|midday|noon|afternoon|dusk|sunset|nightfall|evening|tonight|midnight|overnight|lunchtime|breakfast|dinner)\b/i;

// Locative preposition + a Capitalized proper noun = a named place ("in a Houston
// auditorium", "at the Providence clinic"). Tested on the ORIGINAL-case text so it
// keys on the capital. A digital PLATFORM brand after a locative ("on Facebook")
// is part of the system stage, not a place, so brands are excluded below.
const PROPER_PLACE_RE =
  /\b(?:in|at|on|inside|outside|near|across|beside|behind|by|along|through|onto|into|from)\s+(?:the\s+|a\s+|an\s+|her\s+|his\s+|their\s+)?([A-Z][a-z]+)/g;
const PLATFORM_BRANDS = new Set([
  "Facebook", "Instagram", "Twitter", "Linkedin", "LinkedIn", "Google", "Gmail",
  "Youtube", "YouTube", "Slack", "Zoom", "Tiktok", "TikTok", "Whatsapp", "WhatsApp",
  "Snapchat", "Reddit", "Outlook", "Excel", "Sheets", "Notion", "Trello", "Asana",
]);

// Physical objects, materials, textures, body parts, nature, places, and sensory
// beats. One big alternation; any single hit grounds the scene. Deliberately
// EXCLUDES words whose dominant use is metaphorical ("a loud claim", "a cold
// reply", "come back", "a hard truth", "a sharp answer") and system-adjacent
// words ("window" — a "send window" is not a glass pane) — those would falsely
// ground a purely-digital scene.
const SENSORY_RE = new RegExp(
  "\\b(?:" +
    // materials & textures
    "wood|wooden|walnut|oak|pine|maple|metal|steel|iron|brass|copper|leather|" +
    "fabric|cloth|cotton|wool|linen|silk|quilt|thread|stitch(?:ed|es|ing)?|yarn|" +
    "paper|cardboard|glass|ceramic|porcelain|clay|stone|brick|concrete|rubber|wax|" +
    "oil|grease|soap|ash|soot|dust|mud|soil|dirt|sand|rust|" +
    // nature & weather
    "rain|snow|sleet|wind|sunlight|sunshine|fog|mist|smoke|frost|" +
    "tree|grass|leaf|leaves|river|ocean|mountain|garden|orchard|meadow|" +
    // food & domestic objects
    "coffee|tea|kettle|mug|cup|bottle|jar|plate|bowl|fork|spoon|knife|" +
    "soup|bread|donut|doughnut|fridge|refrigerator|stove|oven|sink|table|desk|" +
    "chair|couch|sofa|bed|pillow|blanket|drawer|shelf|closet|counter|" +
    "door|doorway|wall|floor|ceiling|stair|staircase|porch|hallway|corridor|" +
    "lobby|room|bedroom|bathroom|garage|basement|attic|yard|sidewalk|" +
    "street|road|alley|platform|bench|fence|curb|" +
    // institutional / physical places
    "hospital|clinic|ward|classroom|school|cafeteria|newsroom|auditorium|lab|" +
    "laboratory|factory|plant|warehouse|store|shop|market|church|temple|" +
    "courtroom|stadium|gym|studio|library|museum|kitchen|office|diner|cafe|" +
    "restaurant|bay|dock|farm|" +
    // physical paper / object props
    "poster|notebook|clipboard|whiteboard|chalkboard|binder|folder|envelope|" +
    "postcard|sheet|sketch|pad|sticker|handout|manuscript|seam|gauge|" +
    // vehicles & transit
    "truck|bus|train|subway|bicycle|" +
    // body
    "hand|hands|finger|fingers|fist|palm|wrist|jaw|chin|cheek|forehead|" +
    "feet|knee|knees|shoulder|shoulders|chest|throat|" +
    "eyebrow|lips|tongue|skin|breath|breathing|heartbeat|pulse|" +
    // sound, smell, taste, touch (concrete only)
    "smell|scent|odor|aroma|fragrance|taste|" +
    "warmth|chill|damp|humid|sticky|slippery|" +
    "silence|hum|hums|buzz|buzzes|knock|knocks|whisper|whispers|hiss|creak|" +
    "rattle|echo|thud|clang|chime|footstep|footsteps|" +
    // light
    "shadow|shadows|glare|flicker|candle|lamp|lamplight" +
  ")\\b",
  "i",
);

/** Is the scenario grounded in a lived moment? Returns the first grounding cue
 *  found, or null when the scene is purely abstract. Pure (text → cue|null). */
export function groundingCue(text: string): string | null {
  if (CLOCK_RE.test(text)) return "clock-time";
  if (DAY_RE.test(text)) return "day";
  if (MONTH_RE.test(text)) return "month";
  if (YEAR_RE.test(text)) return "year";
  if (TIME_OF_DAY_RE.test(text)) return "time-of-day";
  const sensory = SENSORY_RE.exec(text);
  if (sensory) return `sensory:${sensory[0].toLowerCase()}`;
  PROPER_PLACE_RE.lastIndex = 0;
  for (let m = PROPER_PLACE_RE.exec(text); m; m = PROPER_PLACE_RE.exec(text)) {
    if (!PLATFORM_BRANDS.has(m[1])) return `place:${m[1]}`;
  }
  return null;
}

/** Distinct abstract-system token keys present in the text. */
export function systemTokens(text: string): string[] {
  const hits: string[] = [];
  for (const { key, re } of SYSTEM_TOKENS) {
    if (re.test(text)) hits.push(key);
  }
  return hits;
}

export type SceneAbstractionHit = {
  /** The distinct system-surface tokens that make the stage abstract. */
  tokens: string[];
  /** The scenario text, for evidence. */
  text: string;
};

const MIN_SYSTEM_TOKENS = 2;

/**
 * Detect an abstract-system scene in one scenario span. Pure (text → hit|null)
 * so it is exhaustively unit-testable. Fires only when the stage is a system
 * (≥2 distinct UI/process tokens) AND the scene carries zero concrete grounding.
 */
export function detectSceneAbstraction(text: string): SceneAbstractionHit | null {
  if (!text || typeof text !== "string") return null;
  if (groundingCue(text) !== null) return null; // grounded → never abstract
  const tokens = systemTokens(text);
  if (tokens.length < MIN_SYSTEM_TOKENS) return null;
  return { tokens, text };
}

const C26_FIX =
  "Stage the scene in a lived human moment with a sensory detail (an object, a texture, a sound, a place, a clock-time), not an abstract process. Illustrate the idea THROUGH a person; never make the form/email/app the protagonist.";

/**
 * C26 — scene abstraction (advisory). A reader-facing example scenario whose
 * stage is an abstract system with no physical-human grounding. MINOR.
 */
export function checkSceneConcreteness(chapter: ChapterV21): CriticFinding[] {
  const findings: CriticFinding[] = [];
  chapter.examples?.forEach((ex, i) => {
    for (const text of allTones(ex.scenario as any)) {
      const hit = detectSceneAbstraction(text);
      if (!hit) continue;
      findings.push(
        finding(
          "C26.scene_abstraction",
          "minor",
          `examples[${i}].scenario: scene staged on an abstract system with no physical-human detail — "${truncate(text, 60)}" (the stage is a UI/process surface [${hit.tokens.join(", ")}] and the scene carries no clock-time, place, physical object, body, or sensory beat). ${C26_FIX}`,
          text,
        ),
      );
      break; // one C26 finding per example is enough to surface the debt
    }
  });
  return findings;
}
