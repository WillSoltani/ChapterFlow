/**
 * Pure, dependency-free moderation helpers for user-submitted community
 * scenarios — no `server-only`, no AWS, no Anthropic — so they are unit-testable
 * under `tsx --test` and run identically on every surface.
 *
 * Two concerns live here:
 *
 *  1. **Prompt-injection hardening** (`wrapUntrustedField`): user fields are
 *     concatenated into the moderation model's user message. We wrap each field
 *     in an explicit, named delimiter and strip any literal closing delimiter the
 *     user typed, so a submission can't terminate its own block early and smuggle
 *     instructions into the surrounding prompt. The system prompt (in
 *     `ai-service.ts`) tells the model to treat delimited contents strictly as
 *     DATA, never as instructions.
 *
 *  2. **Deterministic pre-filter** (`prefilterScenario`): a cheap, code-only
 *     check that runs BEFORE the model call. A hit routes the submission to
 *     human review (`queue_for_review`) — NEVER an auto-reject — preserving the
 *     existing conservative fail-safe-to-queue bias. It catches the obvious
 *     abuse the model shouldn't be paying tokens to adjudicate: links, a small
 *     inline blocklist, and degenerate repetition/gibberish.
 */

// ── Prompt-injection delimiting ──────────────────────────────────────────────

/**
 * Wrap an untrusted user field in a named, delimiter-stripped block.
 * `tag` is a stable label (e.g. "user_scenario"). Any literal `<user_*>` /
 * `</user_*>` delimiter the user typed — this field's OWN tag or a sibling
 * field's — is neutralized so they can't forge a block boundary or close a
 * neighbouring block early. The strip is whitespace-tolerant and
 * case-insensitive. This is best-effort delimiter strip, not a hard guarantee;
 * the model is also instructed (system prompt) to treat everything between the
 * tags as DATA.
 */
export function wrapUntrustedField(tag: string, value: string): string {
  const open = `<${tag}>`;
  const close = `</${tag}>`;
  // Strip ALL `user_*` delimiters (this field's and any sibling's), tolerant of
  // surrounding whitespace and case, so the content can't close its own block
  // early or forge a sibling boundary.
  const escaped = value.replace(/<\/?\s*user_[a-z_]*\s*>/gi, "");
  return `${open}\n${escaped}\n${close}`;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Deterministic pre-filter ─────────────────────────────────────────────────

export type PrefilterReason =
  | "contains_link"
  | "blocklisted_term"
  | "excessive_repetition"
  | "low_diversity_gibberish";

export interface PrefilterResult {
  /** True when at least one deterministic check fired. */
  flagged: boolean;
  /** Distinct reasons, sorted for stable metric dimensions / assertions. */
  reasons: PrefilterReason[];
}

export interface PrefilterInput {
  title: string;
  scenario: string;
  whatToDo: string;
  whyItMatters: string;
}

// URLs / links / bare domains. Conservative: matches an explicit scheme, a
// www.-prefixed host, or a host.tld followed by a path/query — enough to catch
// spam links without flagging ordinary "e.g." / "etc." prose. Markdown link
// syntax is caught via the bracket-paren form too.
// The TLD group includes common URL-shortener / abused TLDs (ly, me, gg, app,
// to, gl, tk) so bit.ly, t.me, discord.gg and bare .ly/.me/.gg/.app hosts are
// caught. A pre-filter hit only routes to queue_for_review (never a reject), so
// erring toward over-matching here is acceptable.
const LINK_RE =
  /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9][a-z0-9-]*\.(?:com|net|org|io|co|info|biz|xyz|ru|cn|link|click|shop|store|ly|me|gg|app|to|gl|tk)\b(?:[/?#]\S*)?/i;
const MARKDOWN_LINK_RE = /\]\(\s*(?:https?:\/\/|www\.)/i;

// Small inline blocklist (no env injection point — deliberately code-only so it
// can't be silently weakened in prod). Word-boundary matched, case-insensitive.
// Kept intentionally small and obvious; the model handles nuanced moderation.
// A hit only ROUTES TO REVIEW — it never auto-rejects.
const BLOCKLIST = [
  // Spam / promo
  "viagra",
  "cialis",
  "casino",
  "crypto airdrop",
  "free money",
  "make money fast",
  "click here",
  "buy now",
  "promo code",
  // Slurs / hate / explicit — minimal seed; the model is the real moderator.
  "fuck",
  "shit",
  "bitch",
  "nigger",
  "faggot",
  "rape",
  "porn",
];

function containsLink(text: string): boolean {
  if (MARKDOWN_LINK_RE.test(text)) return true;
  // Scan all LINK_RE matches; ignore any whose host is immediately preceded by
  // '@' (it's the domain part of an email address like a@b.com, not a link).
  const re = new RegExp(LINK_RE.source, "gi");
  for (let m = re.exec(text); m !== null; m = re.exec(text)) {
    const before = m.index > 0 ? text[m.index - 1] : "";
    if (before === "@") continue;
    return true;
  }
  return false;
}

function containsBlocklisted(text: string): boolean {
  const lower = text.toLowerCase();
  return BLOCKLIST.some((term) => {
    // Word-boundary match for single tokens; substring for multi-word phrases.
    if (/\s/.test(term)) return lower.includes(term);
    return new RegExp(`\\b${escapeRegExp(term)}\\b`, "i").test(lower);
  });
}

/**
 * Excessive repetition: the same token repeated many times (e.g. "test test test
 * test …") or a single token dominating a long body. Conservative thresholds so
 * legitimate prose (which repeats common words a little) never trips it.
 */
function hasExcessiveRepetition(text: string): boolean {
  const tokens = text
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0);
  if (tokens.length < 12) return false; // too short to judge confidently

  // (a) A long run of the identical token in a row.
  let run = 1;
  for (let i = 1; i < tokens.length; i++) {
    if (tokens[i] === tokens[i - 1]) {
      run++;
      if (run >= 6) return true;
    } else {
      run = 1;
    }
  }

  // (b) One token makes up an implausible share of a long body.
  const counts = new Map<string, number>();
  for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
  let max = 0;
  for (const c of counts.values()) if (c > max) max = c;
  if (max / tokens.length > 0.5) return true;

  return false;
}

/**
 * Low lexical diversity over a long body = gibberish / lorem-ipsum / mashed keys.
 * Distinct-token ratio well below normal prose, evaluated only once the body is
 * long enough for the ratio to be meaningful.
 */
function isLowDiversityGibberish(text: string): boolean {
  const tokens = text
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0);
  if (tokens.length < 25) return false;
  const distinct = new Set(tokens).size;
  // Natural English over 25+ words stays comfortably above ~0.35 unique. Below
  // 0.2 is degenerate repetition the model shouldn't pay to read.
  return distinct / tokens.length < 0.2;
}

/**
 * Run all deterministic checks over the combined user-authored text. Pure and
 * side-effect-free. The caller routes any `flagged` result to `queue_for_review`
 * and emits a `ScenarioPrefilterHit` ops metric — it must NEVER auto-reject on a
 * pre-filter hit (conservative fail-safe-to-queue bias).
 */
export function prefilterScenario(input: PrefilterInput): PrefilterResult {
  const combined = [
    input.title,
    input.scenario,
    input.whatToDo,
    input.whyItMatters,
  ].join("\n");

  const reasons = new Set<PrefilterReason>();
  if (containsLink(combined)) reasons.add("contains_link");
  if (containsBlocklisted(combined)) reasons.add("blocklisted_term");
  if (hasExcessiveRepetition(combined)) reasons.add("excessive_repetition");
  if (isLowDiversityGibberish(combined)) reasons.add("low_diversity_gibberish");

  return {
    flagged: reasons.size > 0,
    reasons: [...reasons].sort(),
  };
}
