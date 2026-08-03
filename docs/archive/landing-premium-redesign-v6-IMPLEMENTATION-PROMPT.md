I have everything I need. The deliverable is a single self-contained Markdown prompt synthesizing the provided chosen direction, judge grafts, structured plan, and locked constraints. Writing it now.

# THE EXTENSIVE IMPLEMENTATION PROMPT — ChapterFlow Landing: "The Field Manual"

## 1. Mission

You are implementing a premium, professional, genuinely impressive landing page for **ChapterFlow** that must pass the 5-second test for a *cold, first-time visitor*: pain registered, real product seen running, and an unmistakable "this is a measured, serious instrument — not a startup template" read. You are **elevating** the existing V5 landing on branch `feat/landing-premium-redesign` into the chosen direction **"The Field Manual"**: the entire page becomes the published spec-sheet of one precision instrument — *the retention loop* — documented the way a serious tool documents itself (numbered sections, hairline rules, mono datum-lines, one calibrated cyan signal, and one live hand-scrubbed readout: the FSRS curve). It does not *sell* the loop; it *specifies* it and lets the visitor *operate* it. Build on the V5 spine, do not rebuild it. Harden the load-bearing signature first, wrap it in a mono instrument frame, graft the six approved enhancements, and ship token-clean, accessible, reduced-motion-safe, and `npm run verify` EXIT 0.

---

## 2. Context

**ChapterFlow** is a guided-reading product (Next.js 16 App Router, React 19.2, Tailwind v4, TypeScript) that turns each non-fiction book into a learning **loop**: Summary → real-world Examples/scenarios → **Quiz (passing is the SOLE chapter-completion and next-chapter-unlock gate)** → Practice, with a real **FSRS-5** spaced-repetition engine for long-term retention. The tagline in use is **"Stop forgetting what you read."** Two free books, no fabricated social proof; trust is earned through real memory-science citations.

**The V5 baseline you are elevating (the spine — keep and improve, never regress):**
- **ScrollStory signature** — a pinned, scroll-*scrubbed* section where one scroll position drives the REAL in-app reader (`DesktopReaderShell`) through Summary → Examples → Quiz → Practice in lockstep with a live FSRS retention curve. **Load-bearing invariant: the large recall readout equals the cyan curve's line-height at the playhead.** Never break this.
- **Ledger** — an editorial spec-sheet panel: flat surface, hairline rows, mono line-number + uppercased label + claim + a real inline micro-visual (DepthVisual, ScheduleVisual, StreakVisual, LibraryVisual, AudioVisual).
- **ScienceAndTrust** — the citation layer: a candor column ("we just launched, no reviews we haven't earned"; Anki/Duolingo lineage; two free books) beside a "receipts / source" citation table (Ebbinghaus 1885; Karpicke & Roediger, *Science* 2008; FSRS/Anki).

**Worktree (do all work here):** `/Users/radinsoltani/cf-redesign` on branch `feat/landing-premium-redesign`. Run the dev server in this worktree (per the redesign memory it has been run on port :3007; use that or `npm run dev`).

Relevant files (all under the worktree):
- `app/page.tsx`, `app/globals.css`
- `components/sections/{Hero,ScrollStory,Ledger,ScienceAndTrust,Pricing,FinalCTA,Footer,CurrentYear}.tsx`
- `components/landing/reader-demo/DesktopReaderShell.tsx`
- `components/landing/LandingMotionProvider.tsx`
- `components/ui/button.tsx`
- Data/derivation: `@/lib/catalog-stats` (`CATALOG_BOOK_COUNT_DISPLAY`, `CATALOG_MEDIAN_CHAPTER_MINUTES`), `@/lib/pricing` (`PRICING`, `PRICING.trialDays`, `FREE_OFFER_LABEL`), book covers via `BOOKS_CATALOG`/`getBookCoverPath`/`BookCover`.

---

## 3. LOCKED CONSTRAINTS (verbatim — do NOT violate or re-litigate)

**Owner-locked product/design constraints:**
1. **DARK theme is chosen.** NEVER pitch or reintroduce a light-first landing. (A prior SERIF "wikipedia" look and a light-mode pitch were both rejected — never reintroduce.)
2. **NO AI-cliché purple/pink gradients**, no generic "vibrant block" startup look. This must read as a precision, premium, editorial instrument — not a template.
3. **NO fabricated social proof** / fake testimonials / fake star ratings / fake logos. Trust is earned via real science citations (Ebbinghaus, Karpicke-Roediger testing effect, spacing effect, FSRS) and honest product receipts. This is a "trust WITHOUT social proof" landing.
4. **Build ON the existing V5 work**, do not throw it away: the ScrollStory signature, the editorial Ledger spec-sheet, and the ScienceAndTrust citation layer are the spine. Elevate them; do not regress them.

**Codebase / design-system hard gates (enforced by scanners — CI fails on a hit):**
- **TOKEN-ONLY color.** All colors are CSS variables (`--cf-*` / `--cr-*`) declared in `app/globals.css`. **NEVER use raw hex/rgba in TSX, not even as a `var()` fallback** (scan-style-drift guard (c), no baseline ⇒ CI fails). New tokens MUST be declared in `globals.css`.
- **Tailwind v4 token syntax is the parenthetical shorthand:** `text-(--cf-accent)` / `bg-(--cf-surface)`. **NEVER bracket arbitrary forms** like `-[--x]` or `[color:--x]` (guard (a) rejects them, no baseline).
- **Buttons MUST use `cf-btn` base + a variant** (`cf-btn-primary`/`secondary`/`ghost`/`danger`/`success`) via `components/ui/button.tsx` CVA. Other canonical `@layer` classes: `cf-pill`, `cf-panel`/`-muted`/`-strong`, `cf-banner-*`, `cf-chip`.
- **Lucide icons** imported raw and rendered as JSX, color via `text-(--cf-*)` or inherit, size via `size` prop. NEVER emoji-as-icon, NEVER `style={{color:...}}`.
- **NEVER hardcode catalog/book counts in copy** — import `CATALOG_BOOK_COUNT_DISPLAY` from `@/lib/catalog-stats`. Pricing copy derives from `@/lib/pricing` (`PRICING`). Median chapter minutes from `CATALOG_MEDIAN_CHAPTER_MINUTES`, never a hardcoded `20`.
- **Motion:** respect `prefers-reduced-motion` (`globals.css` has `html[data-motion="reduced"]`). Animate **ONLY transform/opacity/clip-path** (and `mask-position`, off-main-thread). Scroll-**SCRUBBED**, not scroll-**JACKED** (NN/g). V5 uses LazyMotion + a scroll-progress provider (`components/landing/LandingMotionProvider.tsx`).
- **Verify gate:** `npm run verify` = `tsc --noEmit` → unit tests (node:test via tsx) → `scan:style` → `next build`. Must pass **EXIT 0**. Also keep landing e2e (`e2e/`) green.

**Stack:** Next.js 16 App Router, React 19.2, Tailwind v4 (`@theme inline`, no JS config), TypeScript. Server Components by default; landing sections are mostly server-rendered with client islands for motion/interactivity.

---

## 4. North Star — "The Field Manual"

**Big idea.** The whole page is the published spec-sheet of one precision instrument. Numbered sections (§00–§05), hairline rules, mono datum-lines, a single calibrated cyan signal, and one live readout (the FSRS curve) you scrub by hand. Every claim is a stated value with a source. It is an asymmetric editorial spec-sheet built on hairlines, mono datum-lines, and one semantic accent that only ever means "signal / action / retention." Depth comes from grain + hairlines + one restrained *contained* glow — never drop-shadow glass.

**The first five seconds (the bar to clear).** A cold visitor lands on a near-black calibrated field.
- Top-left, in mono micro-type, a folio: **"CHAPTERFLOW · RETENTION INSTRUMENT · SPEC-SHEET §00"**.
- One billboard-scale Satoshi line: **"Stop forgetting what you read."** — the second clause in cyan.
- To the right, the **REAL in-app reader** sits framed as a lit instrument console, quietly auto-running its loop (no phone mockup, no glass card stack), labeled by a mono caption: **"Live reader · auto-playing the loop."**
- A single full-width hairline rule under the fold carries three mono datum-cells: **"MEDIAN CHAPTER ~12 MIN · {N} BOOKS · TWO FREE"** (derived, never hardcoded).
- One primary CTA: **"Start your first chapter →"**, and one ghost: **"Read the spec ↓"**.

In five seconds the visitor reads the pain, sees the actual product running, and registers "this is a measured, serious tool."

**The signature moment.** "Operate the loop," kept exactly as the V5 ScrollStory in mechanics, re-housed inside an **instrument bezel** with a **calibration HUD**:
- a left **tick-axis** labeled retention %,
- a bottom **interval x-axis** labeled in real FSRS intervals (Day 1 / Day 4 / Week 2 / Month 1),
- a **cyan playhead datum-line** that prints the live value as **"R = 0.9x"** in tabular-nums,
- a **four-segment phase rail** at the top that fills as you scrub,
- and during the quiz beat, the readout label flips to **"ACTIVE RECALL — unlock"** and the curve snaps to 100%, making the page's single product mechanic (passing the quiz IS the gate) physically visible.

It feels like turning a dial on a meter and watching the needle respond. **The load-bearing invariant — the readout value equals the cyan line height at the playhead — must remain provably intact.**

**Why it is not generic.** (1) Hero is type-led + real-product-led, no phone-in-glow. (2) The loop is stated ONCE as the scrubbable signature, not restated in four feature cards. (3) Trust is a literal citation ledger with named researchers and sources, not testimonials/logo walls. (4) "Features" are a numbered spec-sheet (§01–§05) with real inline micro-visuals, not a 3-card bento. (5) Depth = grain + hairlines, never drop-shadow glass.

---

## 5. Tool Protocol

You have two design-intelligence tools. **Use them; do not guess.**

### 5a. `ui-ux-pro-max` skill (design knowledge base)

Invoke via the CLI at the skill directory. Run searches like:

```bash
python3 /Users/radinsoltani/.claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system -p "ChapterFlow Field Manual"
python3 /Users/radinsoltani/.claude/skills/ui-ux-pro-max/scripts/search.py "<keyword>" --domain <ux|style|typography|color|landing|chart>
python3 /Users/radinsoltani/.claude/skills/ui-ux-pro-max/scripts/search.py "<keyword>" --stack nextjs
```

Use it to confirm: premium dark single-accent palettes, grain/glow alpha in the premium band (not decorative), 7:1 contrast on near-black, hairline visibility ≥3:1, scroll-scrubbed-not-jacked patterns, reduced-motion fallbacks, hover-via-color-not-scale, six interaction states, no-emoji-icon discipline, CLS-0 image patterns. **Run the per-step skill queries listed in §7.** Treat the skill's **Pre-Delivery Checklist** as part of Definition of Done.

### 5b. Magic MCP (component inspiration)

Magic is reachable two ways:
- **Bridge (works immediately):** `bash /tmp/magic-call.sh <tool> <json>` — e.g.
  ```bash
  bash /tmp/magic-call.sh 21st_magic_component_inspiration '{"message":"<describe the layout>","searchQuery":"<keywords>"}'
  ```
- **Native (after the session reloads MCP):** call the `mcp__magic__*` tools directly.

**Critical rule:** Magic output is **INSPIRATION ONLY — never paste it raw.** Take only the structural layout / interaction mechanic, then **re-implement it from scratch with `cf-*` tokens**, Tailwind v4 parenthetical syntax, `cf-btn`/`cf-pill` primitives, and raw Lucide icons. Strip every hsla/rgba/hex, every gradient, every glass shadow, every emoji. If Magic returns a purple/pink gradient or a glass card stack, that is exactly what we are NOT building — extract the geometry and discard the skin.

---

## 6. Section-by-Section Spec

Treatment, type, motion, and tokens per section. Type system is locked to the **existing V5 pairing — do NOT reintroduce serif:** **Satoshi** (`--font-display`) for billboard headlines and section openers (clamp display scale: `.cf-display-1/2/3` via `--type-display-1/2/3`, tracking ~−0.03 to −0.035em, line-height ~1.02–1.1, `text-wrap:balance`); **Jakarta** (`--font-body`) for prose at 15–18px / line-height 1.55–1.7; **JetBrains Mono** (`--font-mono`) for ALL instrument datum-lines — folios (`.cf-folio`), section numbers, call-numbers, axis ticks, source column, version stamps — with **tabular-nums on every numeric**. Mono is reserved strictly for data/labels, never body prose.

Accent is a **single calibrated cyan** on near-black: canvas `--cf-anchor-bg` (#080B12-class) with `--cf-surface`/`--cf-page-bg` panels; hairlines `--cf-grid-line`/`--border-subtle`/`--border-default` (0.5–1px, visible on dark); text `--text-heading`/`--text-secondary`/`--text-tertiary`/`--text-muted` at ≥7:1; **ONE accent** `--accent-cyan`/`--cf-accent` (#22D3EE, with `-strong`/`-soft`/`-muted`/`-border`) used **only** for the primary CTA, the active section underline, the FSRS curve + playhead readout, and the pass-to-unlock gate moment. No second hue. No purple/pink. No decorative gradient.

### Nav — instrument header bar
Slim fixed bar on `--cf-anchor-bg` with one bottom hairline (`--cf-grid-line`). Left: wordmark + mono spec stamp **"SPEC v1.0"**. Center/right: section anchors as mono section numbers + labels (**§01 LOOP · §02 SPEC · §03 EVIDENCE · §04 LIBRARY · §05 PRICING**), active section underlined in cyan via IntersectionObserver. One `cf-btn-primary` "Start free". No glass blur by default — canvas + hairline only. Lucide via `size` prop.

### §00 Hero — the cover page
Asymmetric 5/7 grid. Left: mono folio "RETENTION INSTRUMENT · §00"; billboard Satoshi headline (clamp display-1) with cyan second clause; a ~34ch body naming the loop ONCE; the Read→Prove→Keep verb-pills; one `cf-btn-primary` + one ghost. Right: the REAL `DesktopReaderShell` in a lit "console" bezel (hairline rim, restrained single *contained* glow — not ambient teal everywhere), auto-running under motion / static under reduced, with the mono caption **"Live reader · auto-playing the loop."** Full-width hairline datum-strip under the fold: mono cells for `CATALOG_MEDIAN_CHAPTER_MINUTES` (~12 min, not hardcoded 20), `CATALOG_BOOK_COUNT_DISPLAY` books, `FREE_OFFER_LABEL`. Faint masked grid backdrop top-left, low-opacity grain over the canvas. Headline paints **server-side as LCP** before the lazy `ssr:false` reader island hydrates.

### §01 The loop — signature (ScrollStory, re-bezeled)
Keep the pinned scroll-scrubbed ScrollStory **verbatim in mechanics**; wrap it in the instrument frame: tick-axis (retention %), interval x-axis (Day1/Day4/Wk2/Mo1), cyan playhead with tabular-num "R = 0.9x" readout, four-segment phase rail filling on scrub, quiz-phase "ACTIVE RECALL — unlock" label snap. **Preserve the readout==line-height invariant** (re-derive every axis tick from the SAME `yOf`/`xOf`/`Rf` geometry — never hardcode a tick). Animate clip-path/opacity/transform only. Add the **TextRevealByWord** scrub on phase captions, driven by the SAME `scrollYProgress`/`draw` already powering reader+curve (per-word opacity dim→lit, off-main-thread). Under reduced-motion AND touch: fully-drawn static diagram + flat auto-playing reader + stepped, fully-lit phase captions — completely comprehensible without scroll. **Absorb** the legacy Problem (Ebbinghaus SVG) + HowItWorks (4 cards) + InteractiveDemo into this one operated instrument — three generic blocks collapse into one.

### §02 Spec-sheet — the Ledger
Keep the V5 Ledger structure (flat `--cf-surface` panel, hairline rows, mono line-number + uppercased label + claim + real inline micro-visual). Elevate each row header from feature-name to **spec-line**: prefix every claim with the forgetting problem it answers (e.g. §02 "Ideas fade between sessions → spaced review returns them at the 90% edge"). Tabular-nums on streak/interval numerics. Graft the **spotlight-mask cursor-following hover** (radial mask tracking `--cr-spotlight-x`/`-y` via a tiny client island, transform/opacity/mask-position only — no scale, no layout shift) so the spec-sheet feels like a live instrument panel you sweep light across. No glass, no glow-as-decoration; depth from the single panel hairline and grain.

### §03 Evidence — the citation ledger (ScienceAndTrust)
Keep the candor column beside the "receipts / Source" citation table. Make this section the **RESOLUTION of the signature**: explicitly restate the exact curve the visitor just scrubbed as cited fact ("here is the 2008 *Science* paper that says retrieval roughly doubles recall"), legitimizing the operate-the-loop beat. Upgrade the table to read like an instrument certification sheet: mono source column, Lucide shield/check/badge glyphs for legitimacy, each row a hairline-separated "claim → predicts → source" line. Add the masked **edge-fade citation marquee** (translate-only, pause-on-hover) feeding REAL citations — citations, never logos/avatars; static (non-scrolling) under reduced-motion.

### §04 Library — the catalog index
Replace any `CounterAnimation` stats with a quiet **catalog index**: a hairline-ruled list/grid of real `next/image` `BookCover` assets with mono call-numbers ("CF-001 … CF-{N}"), uppercased mono category tags, and `CATALOG_BOOK_COUNT_DISPLAY` stated ONCE as a datum (not animated). Reads like the index page of the manual — every title "structured the same way" is the point. Hover = border/opacity shift only, no scale that shifts layout. Pin `aspect-[3/4]` + `sizes` for CLS 0.

### §05 Pricing — the spec & terms sheet
Two tiers as a **terms sheet**, not a "Most popular"-badged card. All prices/labels/trial terms from `@/lib/pricing` `PRICING`; trial days from `PRICING.trialDays`. Benefit rows are Lucide Check/Minus chips with checked/unchecked states, hairline-separated. Pro tier elevated by an inverse surface + a `cf-pill` "Recommended" (no rainbow badge). Real refund link + cancel-anytime line as mono footnotes. **Migrate the legacy `bg-white` knob to a declared token** (token-only).

### Final CTA — the sign-off
Editorial **plus-corner** frame (four Lucide corner marks + a dashed center hairline) on a distinct inverse band — blueprint sign-off, not a glow blob. One short motivational line ("Start the loop on a book you already own."), one `cf-btn-primary`, the two-free-books footnote in mono. Echo the Read→Prove→Keep verb motif from the hero so the page closes its own loop. **Do NOT restate Summary/Examples/Quiz/Practice here.**

### Footer — the colophon
Mono colophon block on `--cf-anchor-bg`: wordmark, "SPEC v1.0", real legal/privacy/refund links, science-sources line repeated as a permanent citation footer (trust surfaced, not buried). Hairline top rule. `CurrentYear` component. Restrained, dense, calm — the back-cover of the manual.

---

## 7. Step-by-Step Build Plan

Each step lists scope, files, Magic usage, skill query, tokens, motion, a11y, and a verify gate. **Run `npm run verify` EXIT 0 after EVERY step.** Step 1 lands tokens + the live violation migration first so `scan:style` never blocks later steps.

### Step 1 — Token foundation + migrate existing violations (do FIRST; everything depends on it)
- **Scope:** Declare every NEW value as `--cf-*`/`--cr-*` tokens in `app/globals.css` across the dark (~324), high-contrast (~425), and light (~533) blocks; fix the one live token violation.
- **Files:** `app/globals.css`; `components/sections/Pricing.tsx:212` (the `bg-white` toggle knob).
- **Magic:** none (pure tokens/CSS).
- **Skill:** `python3 /Users/radinsoltani/.claude/skills/ui-ux-pro-max/scripts/search.py "dark mode OLED single accent color tokens grain noise overlay spotlight mask alpha hairline 7:1 contrast" --domain color` — confirm grain opacity and glow alpha land in the premium-dark band, not decorative.
- **Tokens to declare:** `--cf-grain` (~`color-mix(in srgb, var(--text-muted) 3%, transparent)`); `--cf-glow-contained` (~`color-mix(in srgb, var(--accent-cyan) 16%, transparent)`); `--cf-axis-tint` (axis ticks/labels, subordinate to `--text-tertiary`, ≥3:1); `--cf-playhead-readout` (alias/refine of existing `--cf-engine-readout`); `--cf-spotlight-alpha` (~`color-mix(in srgb, var(--accent-cyan) 9%, transparent)`); `--cf-marquee-fade` (edge-fade mask stop); `--cf-toggle-knob` (replaces `bg-white`); runtime `--cr-spotlight-x` / `--cr-spotlight-y` (add to the scanner `RUNTIME_TOKENS` allowlist). Replace `bg-white` with `bg-(--cf-toggle-knob)`.
- **Reuse (already declared):** `--cf-grid-line`, `--cf-console-rim`, `--cf-engine-readout`, `--cf-spine-decay`, `--accent-cyan`/`--cf-accent` (+ `-strong/-soft/-muted/-border`), `--cf-anchor-*`, `--cf-surface`/`--cf-page-bg`.
- **Motion / a11y:** none new; ensure new tokens keep text ≥7:1 and hairlines/axis ≥3:1 (WCAG 1.4.11) against `--cf-surface`/`--cf-page-bg` in ALL THREE theme blocks.
- **Verify gate:** `npm run verify` EXIT 0 (scan:style green, zero new raw-color drift); grep `components/**` `app/book/**` shows only baselined raw-color entries.
- **Risk:** forgetting the high-contrast/light block → a theme renders wrong though the scanner passes; declare in all three. Runtime `--cr-spotlight-*` must be allowlisted or guard (b) fails.

### Step 2 — Hero: console caption + grain + single contained glow + datum-strip
- **Scope:** Add the mono "Live reader · auto-playing the loop" caption; collapse the dual blurred glows into ONE `--cf-glow-contained`; fold the datum-strip into a single full-width hairline cell row; confirm `~12 min` median uses `CATALOG_MEDIAN_CHAPTER_MINUTES`.
- **Files:** `components/sections/Hero.tsx` (glow/grid ~58–79; console column ~162–180; datum line ~157–159); reuse `CATALOG_MEDIAN_CHAPTER_MINUTES`, `FREE_OFFER_LABEL`.
- **Magic:** `bash /tmp/magic-call.sh 21st_magic_component_inspiration '{"message":"hero with real product UI framed as a lit instrument console, mono caption label under a framed app window, faint masked grid backdrop, single contained accent glow","searchQuery":"hero product console frame caption"}'` — take the framed-window + caption-label layout only; re-key all color to `--cf-*`.
- **Skill:** `... "premium hero 5-second test one primary CTA billboard clamp display headline real product above the fold next/image" --domain landing`.
- **Tokens:** `--cf-glow-contained`, `--cf-grain`.
- **Motion:** caption static; console auto-play already gated on `usePrefersReducedMotion`; keep `DesktopReaderShell` lazy `ssr:false` with dimension-matched skeleton (CLS 0).
- **A11y:** caption is visible mono text (labels the artifact, not aria-hidden); keep `focus-visible:ring` on CTA; one primary + one ghost only.
- **Verify gate:** `npm run verify` EXIT 0; Playwright (start dev, hit `localhost`) screenshot hero at 1440/375 — caption visible, single glow, no CLS jump on reader hydration.
- **Risk:** caption density tipping "sterile" — one short mono line; glow consolidation must not leave a flat-black void band.

### Step 3 — Signature §01: instrument frame + axes + playhead readout + phase rail + ACTIVE RECALL snap (HARDEN the load-bearing moment)
- **Scope:** Wrap the `PinnedStage` chart in a mono instrument bezel — left tick-axis (retention %, re-derive ticks from the existing `GRID`/`yOf`), bottom x-axis (`XTICKS` Day1/Day4/Wk2/Mo1), cyan playhead datum printing "R = 0.9x" tabular-nums (extend the existing `retained` MotionValue), upgrade `PhaseRail` to a four-segment fill, flip the readout label to "ACTIVE RECALL — unlock" + snap curve to 100% on the quiz beat. **Preserve the invariant** (`withRecallPct` already guarantees readout==line-height — introduce NO second number source).
- **Files:** `components/sections/ScrollStory.tsx` (`RetentionChart` ~200–328; `PinnedStage` ~465–545; `PhaseRail` ~388–412; `retained`/`draw` ~559–565; quiz beat ~137–142; `StaticStack` ~415–462 for the static mirror).
- **Magic:** `bash /tmp/magic-call.sh 21st_magic_component_inspiration '{"message":"instrument panel HUD frame with tick axis labels, a vertical playhead readout line printing a live numeric value, four-segment progress rail, monospace data labels on dark","searchQuery":"calibration HUD instrument frame axis playhead"}'` — structural/label layout only; ticks/playhead via `--cf-axis-tint`/`--accent-cyan`/`--cf-playhead-readout`.
- **Skill:** `... "data visualization HUD chart labels tabular-nums scroll-scrubbed not jacked reduced-motion static fallback transform opacity clip-path only" --domain ux` and `--domain chart "trend retention curve"`.
- **Tokens:** `--cf-axis-tint`, `--cf-playhead-readout`.
- **Motion:** extend the existing `clip` (clip-path inset wipe), `playheadX` and `retained` transforms only — NO new animated property. ACTIVE RECALL snap = opacity/label swap keyed to `beatIndex===2`, not a layout change. Static fallback mirrors the new axis labels in `StaticStack`.
- **A11y:** extend the `<svg aria-label>` to describe axes + playhead; keep the `sr-only` BEATS narrative; the readout text node must be real (sr-readable), tabular-nums via `--font-mono`.
- **Verify gate:** `npm run verify` EXIT 0; Playwright fine-pointer: scrub and **manually confirm the printed `R=` value tracks the cyan line height at ≥3 scroll positions** (the invariant); set `html[data-motion=reduced]` and 375px touch → static stack renders axes + ACTIVE RECALL label + flat reader, no nested-scroll trap.
- **Risk:** HIGHEST — any divergence of ticks/readout from `Rf` geometry breaks the invariant; re-derive every tick from `yOf`/`xOf`. The bezel around the reader is a CLS re-entry point — keep fixed `min(560px,70svh)` height.

### Step 4 — Signature §01 graft: TextRevealByWord scrub on phase captions
- **Scope:** Drive the phase-caption copy (`BeatCopy` body) with a per-word opacity dim→lit reveal mapped to the SAME `scrollYProgress`/`draw` already powering reader+curve. Off-main-thread (opacity only), scrubbed-not-jacked, fully-lit static under reduced-motion/touch.
- **Files:** `components/sections/ScrollStory.tsx` (`BeatCopy` ~330–363; reuse the existing `smooth`/`draw` MotionValue — do NOT add a second `useScroll`). Optionally extract a colocated `<TextRevealWords>`.
- **Magic:** `bash /tmp/magic-call.sh 21st_magic_component_inspiration '{"message":"scroll-scrubbed text reveal by word, per-word opacity from dim to lit driven by useScroll scrollYProgress inside a pinned container","searchQuery":"TextRevealByWord scroll opacity scrub"}'` — take the per-word opacity mechanic only; reuse the provider's `m`.
- **Skill:** `... "scroll-scrubbed word reveal accessibility prefers-reduced-motion static text off-main-thread opacity" --domain ux`.
- **Tokens:** none new (`--text-secondary` dim → `--text-heading` lit via opacity).
- **Motion:** opacity per word only; map word-i to a sub-range of `draw` within the active beat band. Under `isStatic` (reduced OR touch) render all words fully lit. Never animate layout/filter.
- **A11y:** keep a single readable text node / natural reading order; the `sr-only` BEATS list covers AT.
- **Verify gate:** `npm run verify` EXIT 0; Playwright: words light on scrub; under `data-motion=reduced` all words fully opaque from first paint.
- **Risk:** per-word opacity churn can jank — derive from the existing spring, cap word count per caption.

### Step 5 — Signature absorption: collapse legacy Problem + HowItWorks + InteractiveDemo
- **Scope:** Confirm/keep the three generic legacy blocks ABSENT from the rendered tree so the loop is stated ONCE. Verify `app/page.tsx` renders only Hero → ScrollStory → Ledger → ScienceAndTrust → (CatalogIndex) → Pricing → FinalCTA; remove any dead legacy imports.
- **Files:** `app/page.tsx` (main tree ~162–169); grep `components/sections/` for orphaned legacy imports.
- **Magic / Skill:** `... "avoid hero plus three feature cards AI template tell problem-first single signature" --domain landing`.
- **Verify gate:** `npm run verify` EXIT 0; `grep -rn "Problem\|HowItWorks\|InteractiveDemo" app/ components/` returns no live renders.
- **Risk:** low — guard against reintroducing the multi-block funnel; the absorbed Ebbinghaus/Karpicke narrative must still appear in §01 BEATS + §03.

### Step 6 — §02 Ledger: spotlight-mask hover + problem-first spec-line headers
- **Scope:** Graft the spotlight-mask cursor-following hover onto `cf-ledger-row` rows (radial mask following `--cr-spotlight-x`/`-y` via a tiny client island, transform/opacity/mask-position only). Elevate each row header to a spec-line prefixed with the forgetting-problem it answers. Tabular-nums on streak/interval numerics.
- **Files:** `components/sections/Ledger.tsx` (`ROWS` ~139–175; row markup ~208–241; add a small `LedgerRow` client wrapper setting CSS vars on `pointermove`).
- **Magic:** `bash /tmp/magic-call.sh 21st_magic_component_inspiration '{"message":"monochrome bento spec rows with cursor-following radial spotlight mask hover driven by --x --y css vars, hairline separators, no scale","searchQuery":"bento monochrome spotlight mask hover cursor"}'` — take the `--x/--y` radial-mask mechanic only; re-key to `--cf-spotlight-alpha`.
- **Skill:** `... "hover via color opacity border not scale spotlight mask performance problem-first feature copy" --domain ux`.
- **Tokens:** `--cf-spotlight-alpha`, `--cr-spotlight-x`, `--cr-spotlight-y`.
- **Motion:** mask position + opacity only on hover (no layout shift, no scale); disable under `prefers-reduced-motion`; micro-interaction ≤300ms ease-out.
- **A11y:** spotlight is pointer-only decorative — `aria-hidden`, never the sole affordance; keyboard focus uses border/opacity, visible focus ring.
- **Verify gate:** `npm run verify` EXIT 0; Playwright: hover sweeps light with cursor; touch shows static rows; reduced-motion = no mask.
- **Risk:** `pointermove` per-row can be chatty — throttle via rAF or set vars on the panel container, not each row. Keep spec-lines problem-first, not a feature list.

### Step 7 — §03 Evidence: resolution-of-the-signature copy + citation marquee + certification table
- **Scope:** Make ScienceAndTrust the RESOLUTION of the signature (restate the exact scrubbed curve as cited fact). Upgrade the table to an instrument-certification sheet (mono source column, Lucide shield/check/badge glyphs, "claim → predicts → source" hairline rows). Add the masked edge-fade citation marquee (translate-only, pause-on-hover) feeding REAL citations.
- **Files:** `components/sections/ScienceAndTrust.tsx` (`CITATIONS` ~20–36 aligned to §01 beats; table ~92–123; raw Lucide `Shield`/`Check`/`Badge`; new colocated `CitationMarquee` client island).
- **Magic:** `bash /tmp/magic-call.sh 21st_magic_component_inspiration '{"message":"masked edge-fade infinite marquee strip, translate-only, pause on hover, for text chips not logos","searchQuery":"marquee edge-fade mask pause on hover"}'` — take the edge-fade mask + translate loop only; re-key stops to `--cf-marquee-fade`.
- **Skill:** `... "trust and authority without social proof metrics with sources shield check badge icons citation receipts" --domain landing`.
- **Tokens:** `--cf-marquee-fade`.
- **Motion:** marquee = `translateX` only, pauses on hover/focus; under `prefers-reduced-motion` render a STATIC non-scrolling citation row (no infinite loop). Section opener keeps existing `SectionReveal`.
- **A11y:** marquee must not trap focus or auto-scroll without a pause affordance; duplicated children `aria-hidden`; icons via `size`/`text-(--cf-*)`, never `style={{color}}`; citations remain real attributable text.
- **Verify gate:** `npm run verify` EXIT 0; Playwright: marquee scrolls + pauses on hover; reduced-motion = static; copy explicitly echoes the §01 curve.
- **Risk:** keep it citations-only (not logo-wall energy), single row, restrained speed; fabricate no metric.

### Step 8 — §04 Library: editorial catalog index (NOT count-up)
- **Scope:** Present the catalog as an editorial index panel — hairline-ruled grid of real `next/image` `BookCover` assets with mono call-numbers ("CF-001 … CF-{N}"), uppercased mono category tags, `CATALOG_BOOK_COUNT_DISPLAY` stated ONCE as a datum (no `CounterAnimation`). Decide placement: a dedicated calm `CatalogIndex` block (between Ledger and ScienceAndTrust) OR expand Ledger row 04 — do NOT add a 9th funnel block.
- **Files:** new `components/sections/CatalogIndex.tsx` (or expand `Ledger.tsx` row 04); `app/page.tsx` (insert if standalone); reuse `BOOKS_CATALOG`, `getBookCoverPath`, `BookCover`, `CATALOG_BOOK_COUNT_DISPLAY`.
- **Magic:** `bash /tmp/magic-call.sh 21st_magic_component_inspiration '{"message":"monochrome editorial bento index grid with tabular call numbers, real cover images, uppercased mono category tags, hairline rules, hover border only","searchQuery":"monochrome bento index grid tabular catalog"}'` — structural asymmetric span grid + tabular-nums only; covers via `next/image`, all color tokenized.
- **Skill:** `... "editorial catalog index grid tabular numbers next/image optimization hover border opacity no layout shift CLS skeleton" --stack nextjs`.
- **Tokens:** reuse `--cf-grid-line`/`--border-subtle`; `--cf-axis-tint` for call-number tint if needed.
- **Motion:** hover = border/opacity shift only; optional `SectionReveal` (transform/opacity).
- **A11y:** `BookCover` carries alt/sizes; call-numbers mono decorative; grid keyboard-navigable if interactive; pin `aspect-[3/4]` + `sizes` for CLS 0.
- **Verify gate:** `npm run verify` EXIT 0; Playwright at 375/768/1440: real covers load, count stated once, zero count-up, CLS 0.
- **Risk:** CLS from un-dimensioned covers; no stats-bar count-up.

### Step 9 — §05 Pricing + Final CTA: terms-sheet polish + plus-corner sign-off
- **Scope:** Pricing into terms-sheet aesthetic (benefit rows as Lucide Check/Minus chips; Pro elevated by inverse surface + `cf-pill` "Recommended", no rainbow badge; all prices/trial from `PRICING`); confirm the `bg-white` knob is gone (Step 1). Reshape FinalCTA into the plus-corner frame (four Lucide corner marks + dashed center hairline) on an inverse band, echoing Read→Prove→Keep, NOT restating the four loop phases.
- **Files:** `components/sections/Pricing.tsx` (knob ~212; benefit rows; badge → `cf-pill`); `components/sections/FinalCTA.tsx`; reuse `PRICING`, `PRICING.trialDays`, `cf-btn` via `components/ui/button.tsx`.
- **Magic:** `bash /tmp/magic-call.sh 21st_magic_component_inspiration '{"message":"editorial CTA with plus-corner frame, four corner marks and dashed center rule on inverse band; pricing terms sheet with check/minus benefit chips and one elevated tier","searchQuery":"plus corner CTA frame pricing terms sheet check chips"}'` — take the plus-corner frame + checked/unchecked chip layout only; drop gradient badges; `cf-btn` + `cf-pill`.
- **Skill:** `... "honest pricing no fake urgency terms sheet six interaction states CTA cf-btn variants no Most popular rainbow badge" --domain landing`.
- **Tokens:** `--cf-toggle-knob`; reuse `--cf-anchor-*` for the inverse band.
- **Motion:** hover/focus color/opacity only; section reveal transform/opacity; no infinite loops.
- **A11y:** full six states on CTA + toggle (default/hover/focus/active/disabled/loading); Lucide Check/Minus via `size`; refund/cancel footnotes in mono with real links; toggle accessible label + `forced-colors` fallback preserved.
- **Verify gate:** `npm run verify` EXIT 0 (knob migration confirmed by scan:style); Playwright: toggle works, no `bg-white`, plus-corner renders both themes.
- **Risk:** removing the badge must keep Pro emphasis (inverse surface + `cf-pill`); FinalCTA must not re-list the four phases.

### Step 10 — Footer colophon + final sweep
- **Scope:** Footer as a mono colophon (wordmark, "SPEC v1.0", real legal/privacy/refund links, science-sources citation footer, hairline top rule, `CurrentYear`). Then a whole-page anti-pattern + token sweep.
- **Files:** `components/sections/Footer.tsx`; `components/sections/CurrentYear.tsx`.
- **Skill:** `... "pre-delivery anti-pattern checklist no emoji icons Lucide sizing visible focus responsive 375 768 1024 1440 animate transform opacity clip-path borders visible on dark" --domain ux`.
- **Verify gate:** `npm run verify` EXIT 0 + landing e2e green; final Playwright pass at 375/768/1024/1440 in both themes and under `data-motion=reduced`; grep confirms no raw hex/rgba (beyond baseline), no bracket-arbitrary Tailwind, no emoji-as-icon, no hardcoded book count or `~20 min`.
- **Risk:** low — consolidation/regression gate.

---

## 8. Suggested Ultracode Orchestration

Run the entire effort in the worktree `/Users/radinsoltani/cf-redesign` on `feat/landing-premium-redesign` (dev server per redesign memory, e.g. :3007 or `npm run dev`).

**Pipeline (sequential where files conflict, isolated where they don't):**
1. **Step 1 (tokens + knob) runs alone and first** — it is a strict dependency for every later step and a serialization point (everyone edits `globals.css`). Gate: `npm run verify` EXIT 0.
2. **§01 chain is strictly serial: Step 3 → Step 4 → Step 5** — all three edit `ScrollStory.tsx` (and Step 5 edits `page.tsx`). Run them in one agent lane, gating `verify` between each. Step 3 (the invariant-hardening) is the highest-risk; do not start Step 4 until Step 3's invariant is proven by Playwright at ≥3 scroll positions.
3. **Steps 2 (Hero), 6 (Ledger), 7 (ScienceAndTrust), 8 (CatalogIndex), 9 (Pricing+FinalCTA), 10 (Footer)** touch disjoint files and MAY run in **parallel isolated lanes** after Step 1 lands — EXCEPT any that re-touch `app/page.tsx` (Step 5, Step 8 if standalone) must serialize on it. Each lane gates on its own `npm run verify` EXIT 0 before merging back.
4. **After all section steps**, run a single **adversarial design + code review pass** with four critics before finishing:
   - **Premium-feel critic** — does it pass the 5-second test (pain + real product running + "measured instrument")? Is it dense-but-calm, problem-first, near-monochrome on one cyan, with NO template tells (no centered glass bento, no count-up, no glow-as-decoration, no purple/pink, no fake proof)?
   - **Token/scanner critic** — grep `components/**`, `app/book/**`, auth-flow TSX for raw hex/rgba beyond baseline; confirm no bracket-arbitrary Tailwind; every new `--cf-*`/`--cr-*` declared in all three theme blocks (or allowlisted); `cf-btn`/`cf-pill` primitives only; counts/prices derived from `CATALOG_*`/`PRICING`.
   - **A11y critic** — visible focus rings, six CTA/toggle states, Lucide via `size`/`text-(--cf-*)` (no `style={{color}}`, no emoji), `<svg aria-label>` + `sr-only` narrative on §01, contrast ≥7:1 text / ≥3:1 hairlines, responsive 375/768/1024/1440, no horizontal scroll, no nested-scroll trap on touch.
   - **Reduced-motion critic** — toggle `html[data-motion="reduced"]`: §01 degrades to fully-drawn static axes + flat auto-playing reader + fully-lit stepped captions; Ledger spotlight off; marquee static (no infinite loop); all reveals at final state; animations are transform/opacity/clip-path/mask-position only; nothing >500ms; no infinite decorative loop survives reduced-motion.
5. Address every confirmed critic finding, re-run `npm run verify` + e2e + the Playwright dual-mode visual pass.
6. **Commit only on explicit owner approval.** Do not commit, push, or open a PR until the owner has read the page in the worktree and approved. Until then leave the work uncommitted in `cf-redesign`.

---

## 9. Definition of Done + Pre-Delivery Checklist

**Definition of Done:**
- `npm run verify` EXIT 0 and landing e2e green on `feat/landing-premium-redesign`.
- §01 signature hardened with the instrument frame (tick-axis, interval x-axis, cyan playhead "R=" readout in tabular-nums, four-segment phase rail, ACTIVE RECALL snap) AND the **readout==line-height-at-playhead invariant provably intact** (verified at ≥3 scroll positions).
- All six grafts merged: spotlight-mask Ledger rows; TextRevealByWord phase captions; §03 evidence-as-resolution copy + citation marquee; hero console caption; editorial catalog index; all new values pre-declared as `--cf-*` tokens with the `bg-white` knob migrated.
- Legacy Problem/HowItWorks/InteractiveDemo absorbed (not rendered); the loop stated once.
- Reads as a near-monochrome editorial spec-sheet on the locked cyan — no purple/pink, no glass-everywhere, no count-up, no fake social proof, no glow-as-decoration; depth from grain + hairlines + one contained glow.
- Fully comprehensible static states under reduced-motion and on 375px touch; CLS 0 around every framed reader/cover; hero headline is LCP before the reader island hydrates.
- Owner can read it in `cf-redesign` and pass the 5-second test: pain + real product running + "measured, serious instrument."

**Pre-delivery checklist (skill checklist + our scanners + Playwright):**
- [ ] **Skill checklist** — no emoji icons (Lucide only); consistent icon set sized via `size`; hover states cause no layout shift; theme tokens used (no `var()`-wrapper hacks, no raw color); all clickable elements have cursor/affordance; transitions 150–300ms; visible focus for keyboard nav; borders visible in dark; floating nav spaced; no content behind fixed nav; responsive 375/768/1024/1440; no horizontal scroll; images have alt; inputs have labels; color is not the only indicator; `prefers-reduced-motion` respected.
- [ ] **Scanners** — `npm run verify` EXIT 0; `scan:style` guards (a) no bracket-arbitrary Tailwind, (b) every `--cf-*`/`--cr-*` declared/allowlisted, (c) no new raw hex/rgba in TSX, (d) no hardcoded catalog counts; pre-commit secret/artifact scan clean.
- [ ] **Derivation** — counts via `CATALOG_BOOK_COUNT_DISPLAY`, median minutes via `CATALOG_MEDIAN_CHAPTER_MINUTES`, all pricing/trial via `PRICING`/`PRICING.trialDays`; `FREE_OFFER_LABEL` for the free-books copy.
- [ ] **Playwright — default mode** at 375/768/1024/1440, both themes: hero passes 5s test, single contained glow, datum-strip correct; §01 scrubs and the `R=` readout tracks the curve; Ledger spotlight sweeps with cursor; §03 marquee scrolls + pauses on hover; §04 covers load with no count-up; §05 toggle works (no `bg-white`); plus-corner FinalCTA + colophon footer render.
- [ ] **Playwright — reduced-motion** (`html[data-motion="reduced"]`) at 375 + 1440: §01 static axes + flat reader + fully-lit captions; Ledger spotlight off; marquee static; all reveals final state; no animation that isn't transform/opacity/clip-path/mask-position; no infinite loop survives.
- [ ] **Invariant proof** — recorded confirmation that the §01 readout value equals the cyan line height at the playhead across ≥3 scroll positions, with axis ticks re-derived from the same `Rf` geometry.
- [ ] **Owner approval obtained before any commit/push/PR.**

---

Deliverable file/paths an engineer needs: worktree `/Users/radinsoltani/cf-redesign`; edit `app/page.tsx`, `app/globals.css`, `components/sections/{Hero,ScrollStory,Ledger,ScienceAndTrust,Pricing,FinalCTA,Footer,CurrentYear}.tsx`, `components/landing/reader-demo/DesktopReaderShell.tsx`, `components/landing/LandingMotionProvider.tsx`, `components/ui/button.tsx`; tools at `/Users/radinsoltani/.claude/skills/ui-ux-pro-max/scripts/search.py` and magic bridge `/tmp/magic-call.sh`.