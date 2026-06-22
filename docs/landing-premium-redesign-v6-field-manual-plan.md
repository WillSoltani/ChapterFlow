No `ring-cyan-400` violations remain in the V5 sections (those were in the legacy production page, not this worktree). The live violations to migrate are: `page.tsx` raw rgba mesh (already tokenized via color-mix actually — wait, those use `var(--accent-cyan)` in color-mix, which is fine; the legacy raw rgba was the old page). Pricing line 212 `bg-white` knob is the real one. No `--cf-grain` exists yet. I now have everything needed to write the plan.

I have enough grounding. Here is the plan.

---

## North Star

The Field Manual reframes the entire landing as the published spec-sheet of one precision instrument — the retention loop — built by *elevating* the existing V5 spine (Hero → ScrollStory signature → Ledger → ScienceAndTrust → Pricing → FinalCTA → Footer), never rebuilding it. We harden the load-bearing signature first (the scroll-scrubbed real reader beside the live FSRS curve, with the inviolable readout==line-height-at-playhead invariant), wrap it in a mono instrument frame (tick-axis, interval x-axis, cyan playhead readout, four-segment phase rail, ACTIVE RECALL snap), and graft six Console/Lens-C/Source-5 enhancements (spotlight-mask Ledger rows, TextRevealByWord phase captions, evidence-as-resolution copy, hero console caption, citation marquee, editorial catalog index). All new visual values become declared `--cf-*` tokens and the one live `bg-white` Pricing-knob violation is migrated *before* any new section ships, so `scan:style` guard (c) stays green. The result is dense-but-calm, problem-first, near-monochrome on the locked cyan, scrubbed-not-jacked, and fully comprehensible as static states under reduced-motion and on touch.

## Steps

### Step 1 — Token foundation + migrate existing violations (do first; everything depends on it)
- **Scope**: Declare every NEW value the plan needs as `--cf-*`/`--cr-*` tokens in `app/globals.css` (light + dark + high-contrast blocks), and fix the one live token violation so the rest of the work can't be blocked by guard (c) mid-stream.
- **Files**: `app/globals.css` (existing token blocks at ~324 dark / ~425 high-contrast / ~533 light); `components/sections/Pricing.tsx:212` (the `bg-white` toggle knob).
- **Magic**: none (pure tokens/CSS).
- **Skill**: `Skill ui-ux-pro-max` query "dark mode OLED single accent color tokens, grain/noise overlay token, spotlight mask alpha, hairline border on near-black 7:1 contrast" — confirm grain opacity and glow alpha land in the premium-dark band, not decorative.
- **Tokens**: `--cf-grain` (low-opacity noise alpha as color-mix of neutral, ~2–3%), `--cf-axis-tint` (instrument-frame axis tick color, subordinate to text-tertiary), `--cf-playhead-readout` (alias to existing `--cf-engine-readout` or a dedicated tabular readout color), `--cf-spotlight-alpha` (Ledger spotlight-mask radial alpha as color-mix of `--accent-cyan` ~8–10%), `--cf-marquee-fade` (edge-fade mask stop), `--cf-glow-contained` (the single contained hero/console glow, color-mix of `--accent-cyan`), `--cr-spotlight-x` / `--cr-spotlight-y` (runtime cursor vars — add to scanner `RUNTIME_TOKENS` allowlist if needed). Replace `bg-white` knob with `bg-(--cf-toggle-knob)` (declare `--cf-toggle-knob`).
- **Motion**: none.
- **A11y**: ensure new axis/readout/grain tokens keep text ≥7:1 and hairlines ≥3:1 (WCAG 1.4.11) against `--cf-surface`/`--cf-page-bg` in all three theme blocks.
- **Verify gate**: `npm run verify` EXIT0 (scan:style must pass with zero new raw-color drift); grep `components/**` `app/book/**` for raw hex/rgba returns only baselined entries.
- **Risk**: Forgetting the high-contrast or light token block → scanner passes but a theme renders wrong; declare in all three. Runtime `--cr-spotlight-*` must be in the allowlist or guard (b) fails.

### Step 2 — Hero: console caption + grain + restrained single glow (highest-impact above-the-fold lift)
- **Scope**: Add the mono "Live reader · auto-playing the loop" caption to the hero console frame (Source 2 must-have, raises the 5s-test clarity Field Manual scores slightly lower on); convert the existing dual blurred glows to ONE contained `--cf-glow-contained`; fold the catalog-derived datum-strip into a single full-width hairline cell row; confirm `~12 min` median uses `CATALOG_MEDIAN_CHAPTER_MINUTES`, never hardcoded 20.
- **Files**: `components/sections/Hero.tsx` (lines 58–79 glow/grid, 162–180 console column, 157–159 datum line); reuse `CATALOG_MEDIAN_CHAPTER_MINUTES` from `@/lib/catalog-stats` and `FREE_OFFER_LABEL` from `@/lib/pricing`.
- **Magic**: `bash /tmp/magic-call.sh 21st_magic_component_inspiration '{"message":"hero with real product UI framed as a lit instrument console, mono caption label under a framed app window, faint masked grid backdrop, single contained accent glow","searchQuery":"hero product console frame caption"}'` — take the framed-window + caption-label layout only; re-key all color to `--cf-*` tokens, drop any hsla/gradient.
- **Skill**: `Skill ui-ux-pro-max` query "premium hero 5-second test, one primary CTA, billboard clamp display headline, real product visualization above the fold, image optimization next/image".
- **Tokens**: `--cf-glow-contained`, `--cf-grain` (from Step 1).
- **Motion**: caption is static text; console auto-play already gated on `usePrefersReducedMotion`. No new motion. Keep DesktopReaderShell lazy `ssr:false` with dimension-matched skeleton (CLS 0).
- **A11y**: caption is decorative-adjacent — render as visible mono text (not aria-hidden) so it labels the artifact; keep the existing `focus-visible:ring` on CTA; one primary CTA + one ghost only.
- **Verify gate**: `npm run verify` EXIT0; Playwright (start `npm run dev`, navigate `localhost:3000`) screenshot hero at 1440/375 — caption visible, single glow, no CLS jump on reader hydration.
- **Risk**: Caption density tipping "sterile"; keep it one short mono line. Glow consolidation must not leave a flat-black void band (the V5 page.tsx fixed mesh already covers global atmosphere).

### Step 3 — Signature §01: instrument frame + axes + playhead readout + phase rail + ACTIVE RECALL snap (harden the load-bearing moment)
- **Scope**: Wrap the existing `PinnedStage` chart in a mono instrument bezel: left tick-axis labeled retention % (re-derive ticks from the SAME `yOf`/`Rf` geometry — already present as `GRID`), bottom x-axis in real FSRS intervals (`XTICKS` already Day1/Day4/Wk2/Mo1), a cyan playhead datum that prints `R = 0.9x` in tabular-nums (extend existing `retained` MotionValue), upgrade the existing `PhaseRail` to a four-segment fill rail, and flip the readout label to "ACTIVE RECALL — unlock" + snap curve to 100% during the quiz beat. **Preserve the invariant**: readout value must equal the cyan line height at the playhead (`withRecallPct` already guarantees this — do not introduce a second number source).
- **Files**: `components/sections/ScrollStory.tsx` (`RetentionChart` 200–328, `PinnedStage` 465–545, `PhaseRail` 388–412, `retained`/`draw` transforms 559–565, `BEATS` quiz beat 137–142, `StaticStack` 415–462 for the static mirror).
- **Magic**: `bash /tmp/magic-call.sh 21st_magic_component_inspiration '{"message":"instrument panel HUD frame with tick axis labels, a vertical playhead readout line printing a live numeric value, four-segment progress rail, monospace data labels on dark","searchQuery":"calibration HUD instrument frame axis playhead"}'` — structural/label layout only; all ticks/playhead via `--cf-axis-tint`/`--accent-cyan`/`--cf-playhead-readout`.
- **Skill**: `Skill ui-ux-pro-max` query "data visualization HUD chart labels tabular-nums, scroll-scrubbed not jacked, reduced-motion static fallback, animate transform opacity clip-path only".
- **Tokens**: `--cf-axis-tint`, `--cf-playhead-readout` (from Step 1).
- **Motion**: extend the existing `clip` (clip-path inset wipe), `playheadX` and `retained` transforms only — no new animated property. ACTIVE RECALL snap = opacity/label swap keyed to `beatIndex===2`, not a layout change. Static fallback: axes fully drawn, label reads steady "ACTIVE RECALL" in the static beat list, reader flat auto-play — already structured in `StaticStack`, mirror the new axis labels there.
- **A11y**: extend the existing `<svg aria-label>` to describe the axes + playhead; keep the `sr-only` BEATS narrative; ensure the readout text node is real (sr-readable), tabular-nums via `--font-mono`.
- **Verify gate**: `npm run verify` EXIT0; Playwright desktop fine-pointer: scrub the section, assert the printed `R=` value tracks the cyan line height (manually compare at 3 scroll positions); set `html[data-motion=reduced]` and 375px touch → static stack renders axes + ACTIVE RECALL label + flat reader, no nested-scroll trap.
- **Risk**: HIGHEST — any divergence of axis ticks/readout from `Rf` geometry breaks the invariant. Re-derive every tick from `yOf`/`xOf`; never hardcode a tick value. Adding the bezel around the reader console is a CLS re-entry point — keep fixed `min(560px,70svh)` height.

### Step 4 — Signature §01 graft: TextRevealByWord scrub on phase captions (Lens C high-value bespoke layer)
- **Scope**: Drive the signature's phase-caption copy (`BeatCopy` body) with a per-word opacity dim→lit reveal mapped to the SAME `scrollYProgress`/`draw` already powering reader+curve. Off-main-thread (opacity only), scrubbed not jacked, degrades to fully-lit static under reduced-motion/touch.
- **Files**: `components/sections/ScrollStory.tsx` (`BeatCopy` 330–363; reuse the existing `smooth`/`draw` MotionValue rather than a new `useScroll`). Optionally extract a small `<TextRevealWords>` helper colocated in the file.
- **Magic**: `bash /tmp/magic-call.sh 21st_magic_component_inspiration '{"message":"scroll-scrubbed text reveal by word, per-word opacity from dim to lit driven by useScroll scrollYProgress inside a pinned container","searchQuery":"TextRevealByWord scroll opacity scrub"}'` — take the useScroll→per-word opacity mechanic only; reuse LandingMotionProvider's `m`, no new lib color.
- **Skill**: `Skill ui-ux-pro-max` query "scroll-scrubbed word reveal accessibility, prefers-reduced-motion static text, off-main-thread opacity animation".
- **Tokens**: none new (uses `--text-secondary` dim → `--text-heading`/lit via opacity).
- **Motion**: opacity per word only; map word-i to a sub-range of `draw` within the active beat band. Under `isStatic` (reduced OR touch OR unmounted) render all words fully lit (no per-word opacity). Never animate layout/filter.
- **A11y**: words must remain a single readable text node for screen readers (wrap spans but keep natural reading order); the `sr-only` BEATS list already covers AT. Reduced-motion = fully legible.
- **Verify gate**: `npm run verify` EXIT0; Playwright: confirm words light up on scrub, and under `data-motion=reduced` all words are fully opaque from first paint.
- **Risk**: Per-word opacity churn can jank if over-subscribed — derive from the existing spring, don't add a second scroll listener; cap word count per caption.

### Step 5 — Signature absorption: collapse legacy Problem + HowItWorks + InteractiveDemo into §01 (anti-template silhouette)
- **Scope**: Explicitly confirm/keep the three generic legacy blocks ABSENT from the rendered tree so the loop is stated ONCE as the operated instrument (Console graft). Verify `app/page.tsx` renders only Hero → ScrollStory → Ledger → ScienceAndTrust → Pricing → FinalCTA (it already does); ensure no dead imports of legacy `Problem`/`HowItWorks`/`InteractiveDemo` and that the Ebbinghaus narrative now lives solely in the signature + ScienceAndTrust.
- **Files**: `app/page.tsx` (162–169 main tree — already correct); grep for orphaned legacy section imports across `components/sections/`.
- **Magic**: none.
- **Skill**: `Skill ui-ux-pro-max` query "avoid hero plus three feature cards AI template tell, problem-first storytelling single signature".
- **Tokens**: none.
- **Motion**: none.
- **A11y**: maintain one logical heading order; the absorbed narrative must still expose Ebbinghaus/Karpicke citations (in §01 BEATS + §03).
- **Verify gate**: `npm run verify` EXIT0; `grep -rn "Problem\|HowItWorks\|InteractiveDemo" app/ components/` returns no live renders.
- **Risk**: Low. Mainly a guard against regression — if legacy files still exist in `components/sections/`, leave them unimported (don't reintroduce the 9-block funnel).

### Step 6 — §02 Ledger: spotlight-mask cursor-following hover + problem-first spec-line headers
- **Scope**: Graft the Console spotlight-mask hover onto the existing `cf-ledger-row` rows (radial mask following `--cr-spotlight-x`/`-y` via a tiny client island, transform/opacity/mask only) so the spec-sheet feels like a live instrument panel. Elevate each row header from feature-name to spec-line by prefixing the forgetting-problem it answers (e.g. §02 "Ideas fade between sessions → spaced review returns them at the 90% edge"). Tabular-nums on streak/interval numerics.
- **Files**: `components/sections/Ledger.tsx` (`ROWS` titles/desc 139–175, row markup 208–241; add a small `LedgerRow` client wrapper setting the CSS vars on `pointermove`); reuse `--font-mono` for numerics.
- **Magic**: `bash /tmp/magic-call.sh 21st_magic_component_inspiration '{"message":"monochrome bento spec rows with cursor-following radial spotlight mask hover driven by --x --y css vars, hairline separators, no scale","searchQuery":"bento monochrome spotlight mask hover cursor"}'` — take the `--x/--y` radial-mask hover mechanic only; re-key its rgba aurora to `--cf-spotlight-alpha` color-mix of `--accent-cyan`.
- **Skill**: `Skill ui-ux-pro-max` query "hover via color opacity border not scale, spotlight mask card hover performance, problem-first feature copy".
- **Tokens**: `--cf-spotlight-alpha`, `--cr-spotlight-x`, `--cr-spotlight-y` (from Step 1; runtime vars in allowlist).
- **Motion**: mask position + opacity only on hover (no layout shift, no scale). Disable the pointer-driven mask under `prefers-reduced-motion` (render rows flat). Micro-interaction ≤300ms ease-out.
- **A11y**: spotlight is purely decorative (pointer-only) — hidden from AT, never the only affordance; keyboard focus on any interactive row uses border/opacity, not the mask. Maintain visible focus ring.
- **Verify gate**: `npm run verify` EXIT0; Playwright: hover a row, confirm light sweeps with cursor; touch viewport shows static rows; reduced-motion = no mask.
- **Risk**: `pointermove` per-row can be chatty — throttle via rAF or set vars on the panel container, not each row. Spec-line headers must stay problem-first without tipping into a feature list (Source 4 warning).

### Step 7 — §03 Evidence: resolution-of-the-signature copy + citation marquee + certification-sheet table
- **Scope**: Make ScienceAndTrust the RESOLUTION of the signature — restate the exact curve the visitor just scrubbed as cited fact ("here is the 2008 Science paper that says retrieval roughly doubles recall"), legitimizing the operate-the-loop beat (Console graft, pure copy/sequencing). Upgrade the citation table to an instrument-certification sheet (mono source column, Lucide shield/check/badge glyphs, "claim → predicts → source" hairline rows). Add the masked edge-fade citation MARQUEE (translate-only, pause-on-hover) feeding REAL citations, never logos (Lens C / Source 5 graft).
- **Files**: `components/sections/ScienceAndTrust.tsx` (`CITATIONS` 20–36 — align copy to the §01 beats; table 92–123; add Lucide `Shield`/`Check`/`Badge` raw JSX; new colocated `CitationMarquee` client island).
- **Magic**: `bash /tmp/magic-call.sh 21st_magic_component_inspiration '{"message":"masked edge-fade infinite marquee strip, translate-only, pause on hover, for text chips not logos","searchQuery":"marquee edge-fade mask pause on hover"}'` — take the edge-fade mask + translate loop only; feed citation strings, re-key mask stops to `--cf-marquee-fade`.
- **Skill**: `Skill ui-ux-pro-max` query "trust and authority without social proof, metrics with sources, shield check badge icons, citation receipts".
- **Tokens**: `--cf-marquee-fade` (from Step 1).
- **Motion**: marquee = `translateX` only, infinite but pauses on hover/focus; under `prefers-reduced-motion` render a static non-scrolling citation row (no infinite loop — Source 3 HIGH rule). Section opener keeps existing `SectionReveal`.
- **A11y**: marquee must not trap focus or auto-scroll without a pause affordance; duplicate children get `aria-hidden`; icons are raw Lucide via `size` prop, color via `text-(--cf-*)`, never `style={{color}}`. Citations remain real attributable text.
- **Verify gate**: `npm run verify` EXIT0; Playwright: marquee scrolls + pauses on hover; reduced-motion = static; verify copy explicitly echoes the §01 curve.
- **Risk**: Marquee can read as "logo wall" energy — keep it citations-only, restrained speed, single row. Don't fabricate any metric.

### Step 8 — §04 Library: editorial catalog index (bento/index panel, real covers, tabular call-numbers — NOT count-up)
- **Scope**: Present the catalog as an editorial index panel: hairline-ruled grid of real `next/image` `BookCover` assets with mono call-numbers (`CF-001 … CF-{N}`), uppercased mono category tags, `CATALOG_BOOK_COUNT_DISPLAY` stated ONCE as a datum (no `CounterAnimation`). Reads like the manual's index page. (Currently the Ledger's row 04 carries a small `LibraryVisual`; promote breadth into a dedicated calm index block per the §04 spec, or expand row 04 — confirm placement with the existing Ledger structure rather than adding a 9th funnel block.)
- **Files**: new `components/sections/CatalogIndex.tsx` (or expand `Ledger.tsx` row 04); `app/page.tsx` (insert between Ledger and ScienceAndTrust if standalone); reuse `BOOKS_CATALOG`, `getBookCoverPath`, `BookCover`, `CATALOG_BOOK_COUNT_DISPLAY`.
- **Magic**: `bash /tmp/magic-call.sh 21st_magic_component_inspiration '{"message":"monochrome editorial bento index grid with tabular call numbers, real cover images, uppercased mono category tags, hairline rules, hover border only","searchQuery":"monochrome bento index grid tabular catalog"}'` — structural asymmetric span grid + tabular-nums only; covers via `next/image`, all color tokenized.
- **Skill**: `Skill ui-ux-pro-max` query "editorial catalog index grid, tabular numbers, next/image optimization, hover border opacity no layout shift, CLS skeleton".
- **Tokens**: reuse `--cf-grid-line`/`--border-subtle`; no new color unless a call-number tint is needed (`--cf-axis-tint`).
- **Motion**: hover = border/opacity shift only, no scale that shifts layout; optional on-intersection `SectionReveal` (transform/opacity). 
- **A11y**: covers via `BookCover` (already has alt/sizes); call-numbers are mono decorative labels; grid keyboard-navigable if interactive. Dimension-matched `next/image sizes` to keep CLS 0.
- **Verify gate**: `npm run verify` EXIT0; Playwright at 375/768/1440: real covers load, count stated once, zero count-up, CLS 0.
- **Risk**: CLS from un-dimensioned covers — pin `aspect-[3/4]` + `sizes`. Don't reintroduce stats-bar count-up.

### Step 9 — §05 Pricing + Final CTA: terms-sheet polish (knob already migrated in Step 1) + plus-corner sign-off
- **Scope**: Bring Pricing into the terms-sheet aesthetic (benefit rows as Lucide Check/Minus chips, Pro elevated by inverse surface + `cf-pill` "Recommended" not a rainbow badge; all prices/trial from `PRICING`); confirm the `bg-white` knob is gone (Step 1). Reshape FinalCTA into the editorial plus-corner frame (four Lucide corner marks + dashed center hairline) on an inverse band, echoing Read→Prove→Keep, NOT restating Summary/Examples/Quiz/Practice.
- **Files**: `components/sections/Pricing.tsx` (knob 212, benefit rows, badge → `cf-pill`); `components/sections/FinalCTA.tsx` (plus-corner frame); reuse `PRICING`, `PRICING.trialDays`, `cf-btn` variants via `components/ui/button.tsx`.
- **Magic**: `bash /tmp/magic-call.sh 21st_magic_component_inspiration '{"message":"editorial CTA with plus-corner frame, four corner marks and dashed center rule on inverse band; pricing terms sheet with check/minus benefit chips and one elevated tier","searchQuery":"plus corner CTA frame pricing terms sheet check chips"}'` — take the plus-corner frame + checked/unchecked chip layout only; drop all gradient badges; cf-btn + cf-pill.
- **Skill**: `Skill ui-ux-pro-max` query "honest pricing no fake urgency, terms sheet, six interaction states for CTA, cf-btn variants, no Most popular rainbow badge".
- **Tokens**: `--cf-toggle-knob` (Step 1); reuse `--cf-anchor-*` for the inverse CTA band.
- **Motion**: hover/focus color/opacity only; section reveal transform/opacity. No infinite loops.
- **A11y**: full six states on CTA + toggle (default/hover/focus/active/disabled/loading); Lucide Check/Minus via `size`; refund/cancel footnotes in mono, real links; toggle has accessible label + `forced-colors` fallback (preserve existing).
- **Verify gate**: `npm run verify` EXIT0 (knob migration confirmed by scan:style); Playwright: pricing toggle works, no `bg-white`, plus-corner renders both themes.
- **Risk**: Removing the badge must not lose Pro emphasis — use inverse surface + `cf-pill`. FinalCTA must not re-list the four loop phases (Source 1 dedup rule).

### Step 10 — Footer colophon + final sweep
- **Scope**: Footer as a mono colophon (wordmark, "SPEC v1.0", real legal/privacy/refund links, science-sources line as a permanent citation footer, hairline top rule, `CurrentYear`). Then a whole-page anti-pattern + token sweep.
- **Files**: `components/sections/Footer.tsx`; `components/sections/CurrentYear.tsx` (reuse).
- **Magic**: none.
- **Skill**: `Skill ui-ux-pro-max` query "pre-delivery anti-pattern checklist: no emoji icons, Lucide sizing, visible focus, responsive 375/768/1024/1440, animate transform/opacity/clip-path only, borders visible on dark".
- **Tokens**: reuse `--cf-anchor-*`/`--cf-grid-line`.
- **Motion**: none decorative.
- **A11y**: trust surfaced (citations in footer), real links, visible focus.
- **Verify gate**: `npm run verify` EXIT0 + landing e2e green; final Playwright pass at 375/768/1024/1440 in both themes and under `data-motion=reduced`; grep confirms no raw hex/rgba, no emoji-as-icon, no bracket-arbitrary Tailwind.
- **Risk**: Low; this is the consolidation/regression gate.

## Global Token Additions

Declare in `app/globals.css` across the dark (~324), high-contrast (~425), and light (~533) blocks (values are illustrative; tune via the skill):
- `--cf-grain` — low-opacity neutral noise alpha (~`color-mix(in srgb, var(--text-muted) 3%, transparent)`).
- `--cf-glow-contained` — the single contained hero/console glow (`color-mix(in srgb, var(--accent-cyan) 16%, transparent)`).
- `--cf-axis-tint` — instrument-frame axis tick/label color (subordinate to `--text-tertiary`, ≥3:1).
- `--cf-playhead-readout` — tabular readout digits (alias or refine of existing `--cf-engine-readout`).
- `--cf-spotlight-alpha` — Ledger spotlight-mask radial (`color-mix(in srgb, var(--accent-cyan) ~9%, transparent)`).
- `--cf-marquee-fade` — citation-marquee edge-fade mask stop color.
- `--cf-toggle-knob` — replaces the literal `bg-white` Pricing knob.
- `--cr-spotlight-x`, `--cr-spotlight-y` — runtime cursor vars (add to scanner `RUNTIME_TOKENS` allowlist).

Reuse (already declared): `--cf-grid-line`, `--cf-console-rim`, `--cf-engine-readout`, `--cf-spine-decay`, `--accent-cyan`/`--cf-accent` (+ `-strong/-soft/-muted/-border`), `--cf-anchor-*`, `--cf-surface`/`--cf-page-bg`.

## Motion Budget

- Animate ONLY transform / opacity / clip-path / mask-position (off-main-thread). No top/left/width/height, no layout-shifting scale on hover.
- Signature (§01): one `scrollYProgress` → spring → `draw`, fanned to `clip` (clip-path inset), `playheadX` (transform), `retained` (text), `beatIndex`, AND the per-word caption opacity (Step 4) — a single scroll source, scrubbed/reversible, never jacked.
- Micro-interactions 150–300ms, ease-out enter / ease-in exit, never >500ms. Marquee = the only continuous loop (citations), and it pauses on hover/focus and goes static under reduced-motion.
- Hero LCP = server-painted headline before the lazy `ssr:false` reader island hydrates; dimension-matched skeletons keep CLS 0 around every framed reader/cover.
- Under `html[data-motion="reduced"]` AND touch: §01 = fully-drawn static axes + flat auto-playing reader + stepped fully-lit captions; Ledger spotlight off; marquee static; all reveals render final state.

## A11y Checklist

- Every interactive element: visible `focus-visible` ring (cyan), six states designed for CTAs + the Pricing toggle (default/hover/focus/active/disabled/loading).
- Raw Lucide icons via `size` prop, color via `text-(--cf-*)`/inherit — never emoji, never `style={{color}}`.
- §01 keeps its `<svg aria-label>` (extended for axes/playhead) + the `sr-only` BEATS narrative; the playhead readout and per-word captions stay screen-reader-readable in natural order.
- Decorative-only layers (spotlight mask, contained glow, grain, duplicated marquee children) are `aria-hidden` and never the sole affordance.
- Contrast: text ≥7:1, hairlines/axis ≥3:1 (WCAG 1.4.11) on `--cf-surface`/`--cf-page-bg` in all three theme blocks; `forced-colors` fallback preserved on the Pricing toggle.
- Responsive verified at 375/768/1024/1440; no horizontal scroll; touch never traps nested scroll in §01.
- One primary CTA per surface; trust/citations surfaced in-flow and in the footer (not buried).

## Verify Strategy

- `npm run verify` (tsc --noEmit → node:test units → `scan:style` → `next build`) must return EXIT 0 after EVERY step — Step 1 lands the tokens + knob migration first so `scan:style` guard (c) never blocks later steps; re-run after each.
- Keep the landing e2e green: `npm run test:e2e` (dev mode covers all non-`@prod` specs against `npm run dev`, DEV_AUTH_BYPASS/no data — pages must degrade gracefully).
- Manual real-app proof via Playwright MCP (start `npm run dev`, hit `localhost:3000`): per-step screenshots at 1440 + 375, both themes, and with `html[data-motion="reduced"]` toggled. For §01, manually confirm the readout `R=` value equals the cyan line height at ≥3 scroll positions (the invariant) and that the static/touch fallback is fully comprehensible.
- Pre-ship grep: no raw hex/rgba in `components/**` `app/book/**` (beyond baseline), no bracket-arbitrary Tailwind (`-[--x]`/`[color:--x]`), no emoji-as-icon, no hardcoded book count or `~20 min` (must be `CATALOG_*`/`PRICING`).

## Definition of Done

- `npm run verify` EXIT 0 and landing e2e green on `feat/landing-premium-redesign`.
- The §01 signature is hardened with the instrument frame (axes, cyan playhead `R=` readout in tabular-nums, four-segment phase rail, ACTIVE RECALL snap) AND the readout==line-height-at-playhead invariant is provably intact; all 6 grafts are merged: spotlight-mask Ledger rows, TextRevealByWord phase captions, §03 evidence-as-resolution copy + citation marquee, hero console caption, editorial catalog index, and all new values pre-declared as `--cf-*` tokens with the `bg-white` knob migrated.
- Legacy Problem/HowItWorks/InteractiveDemo are absorbed into the one operated instrument (not rendered); the loop is stated once.
- Page reads as a near-monochrome editorial spec-sheet on the locked cyan — no purple/pink, no glass-everywhere, no count-up, no fake social proof, no glow-as-decoration; depth from grain + hairlines + one contained glow.
- Fully comprehensible static states under reduced-motion and on 375px touch; CLS 0 around every framed reader/cover; hero headline is LCP before the reader island hydrates.
- The owner can read it in the worktree (`cf-redesign`, port per the redesign memory) and pass the 5-second test: pain + real product running + "measured, serious instrument."

Relevant absolute paths: `/Users/radinsoltani/cf-redesign/app/page.tsx`, `/Users/radinsoltani/cf-redesign/app/globals.css`, `/Users/radinsoltani/cf-redesign/components/sections/{Hero,ScrollStory,Ledger,ScienceAndTrust,Pricing,FinalCTA,Footer,CurrentYear}.tsx`, `/Users/radinsoltani/cf-redesign/components/landing/reader-demo/DesktopReaderShell.tsx`, `/Users/radinsoltani/cf-redesign/components/landing/LandingMotionProvider.tsx`, `/Users/radinsoltani/cf-redesign/components/ui/button.tsx`, magic bridge `/tmp/magic-call.sh`, skill `/Users/radinsoltani/.claude/skills/ui-ux-pro-max`.