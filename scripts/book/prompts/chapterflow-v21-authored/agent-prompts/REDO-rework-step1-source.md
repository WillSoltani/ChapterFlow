# Redo (Step 1) — rework — FULL sidecar re-research (templated synthetic source)

You are the **researcher (Step 1)** agent for *Rework* by Jason Fried & David Heinemeier
Hansson. The prior Step-1 run produced **synthetic, templated source notes** instead of real
extraction. Every one of the 88 sidecars is affected, so this is **not patchable** — all 88
chapter source sidecars must be re-researched from the real book.

Run dir: `.chapterflow/runs/rework/20260601-083527`

> ✅ The **toc.json and the chapter index are correct** — 12 real sections (First, Takedowns,
> Go, Progress, Productivity, Competitors, Evolution, Promotion, Hiring, Damage Control, Culture,
> Conclusion), 88 real essay titles, in order. **Do NOT rewrite Artifact A (toc) or Artifact C
> (index).** Only re-produce **Artifact B** — the 88 `sidecars/source/ch<NN>.source.json` files
> (and their `.txt` renders). Sanity-check a handful of titles against the real book as you go,
> but do not renumber or rename.

---

## What is wrong (with verbatim evidence)

`check-source` reports **PASS (0/0/0)** on the current sidecars — **do not trust that.** The gate
is blind to this failure mode: the content is internally coherent because it was generated from a
template with per-chapter slot-filling, which dodges the SC8 8-gram duplicate threshold. The
content is hollow. Four distinct templating defects, measured across all 88 chapters:

1. **Circular central concepts — 88/88.** Every `centralConcept.plainDefinition` is the same
   boilerplate with the title slotted in:
   - ch06: *"Workaholism means applying workaholism as a visible operating rule…"*
   - ch04: *"Planning is guessing means applying planning is guessing as a visible operating rule…"*
   This defines a term using the term. It teaches nothing.

2. **Placeholder named examples — 25 unique labels across 88 chapters, reused in consecutive
   blocks.** ch02–ch07 *all* carry the identical anchor `"37signals operating against conventional
   advice"` with a fill-in-the-blank summary: *"The recurring 37signals operating against
   conventional advice case shows old advice survives through repetition even when conditions have
   changed. In practical terms, <chapter's focus phrase>."* The top labels repeat 11×, 11×, 10×,
   8×, 8×. The named example does not name the chapter's actual illustration.

3. **Templated `focus` tails — one boilerplate clause per section, glued onto every chapter in
   it.** All of Takedowns (ch2–7) ends with *"…knocks down inherited business rituals before they
   harden into obligations."* All of Competitors (ch41–45) ends with *"…reframes rivalry as
   positioning rather than imitation."* 20 distinct tail-strings for 88 chapters = the focus was
   written per-section, not per-essay.

4. **Filler key-claims reused across chapters** — e.g. *"Old advice survives through repetition
   even when conditions have changed."*

For contrast, the dare-to-lead and everything-is-fcked Step-1 runs are correct: 0 circular
concepts, every anchor distinct, real specifics. Match that bar.

---

## What you produce (per STEP-1-RESEARCH.md, Artifact B)

Re-research **all 88** chapters into `sidecars/source/ch01..ch88.source.json`, each matching the
`ChapterResearchResult` schema and obeying all 10 Artifact-B hard rules in
`agent-prompts/STEP-1-RESEARCH.md`. Then render each `.txt` with the command in that file
(§ "After saving each chapter's .json…"). The downstream writers never see the book — **your
output IS the source.** Vague/templated source → templated chapters → guaranteed Step-2
intra-book blockers (AS9/AS10/AS11). Be specific and real.

### Faithfulness — the hard constraint

*Rework* genuinely is one long 37signals / Basecamp case study, so **37signals, Basecamp, Jason
Fried, DHH, and Ruby on Rails will recur — that is faithful, do not avoid them.** What is banned
is the *generic, reused* anchor. Each chapter's `namedExamples` must capture **that essay's
specific practice, story, number, or stance** — the same company, but the concrete instance the
essay actually uses. **Do not invent.** If an essay genuinely argues a point without a discrete
named case, anchor it to the specific 37signals *practice* that essay describes, not a generic
"operating against conventional advice" label.

High-confidence real anchors to place **only in the essay where they actually appear** (verify
position against the real book — do not guess):
- *Scratch your own itch* — Basecamp was built to solve 37signals' own project-coordination pain
  as a consultancy; **Ruby on Rails was extracted by DHH from Basecamp's own code.** (the
  founding story; "Go" section)
- *Planning is guessing* — they relabel long-range "plans" as "guesses."
- *Workaholism* / *Fire the workaholics* — workaholics aren't heroes; they create problems and
  signal broken systems.
- *Enough with entrepreneurs* — drop the word; call them "starters."
- *Build half a product, not a half-assed product*; *Underdo your competition.*
- *Out-teach your competition* / *Emulate drug dealers* — 37signals shared methodology openly
  (the *Signal vs. Noise* blog, the free *Getting Real* book, teaching as marketing); give a free
  taste. (Promotion section)
- *Meetings are toxic*; *Interruptions are the enemy of productivity*; *ASAP is poison.*
- *Hire managers of one*; *Hire great writers*; *Geography is irrelevant.* (Hiring section)
- *Inspiration is perishable.* (Conclusion, ch88)

These are illustrations of the **specificity bar**, not an assignment table. Ground each in the
real essay before you use it.

---

## Anti-templating rules (these are what failed — do not repeat)

1. **`centralConcept.plainDefinition` must define in independent words.** Never "X means applying
   X…". Define the idea without using the chapter's title/term as the verb.
2. **`namedExamples` must be chapter-specific.** No two chapters may share an identical `label`
   **or** `summary`. Same entity (37signals/Basecamp) is allowed; same generic instance is not.
   Each summary must describe the concrete practice/story *this* essay uses.
3. **`focus` is written per-essay.** No section-wide boilerplate clause appended to every chapter
   in a section. Two chapters in the same section must not end with the same tail.
4. **`keyClaims` are chapter-specific.** No filler sentence reused verbatim across chapters.
5. Obey Artifact-B rules 1–10: paraphrase only; no meta-references ("this chapter / the author /
   Chapter N"); no author-surname-verb ("Fried argues"); name a mechanism/number/place/behavior;
   real `hardEdge` mis-takeaway; `paraphraseNotes` 200–400 dense specific words; observational
   `voiceCues`; `forbiddenLeakage` to keep later-section concepts out of earlier ones.

### Scale guidance (88 short essays)

Work **section by section in order** (Takedowns → Go → … → Conclusion). Rework's essays are
short (1–2 pages), so 1 named example per chapter is often legitimate — but it must be the
*specific* one, and `paraphraseNotes` must still reach ~200 words of real, specific content
(argument + the concrete 37signals practice + the hard edge), not padding. Use `forbiddenLeakage`
to stop a section's recurring theme (e.g. Promotion's "out-teach") from leaking into earlier
sections.

---

## Procedure

1. Re-research all 88 sidecars (`.json` + `.txt` render). Leave toc.json and the index untouched.
2. `npx tsx src/cli.ts check-source rework` → must be **PASS 0/0/0**.
3. **Mandatory extra checks the gate cannot do** (it passed the broken version). Run these and
   confirm each:

   ```bash
   # run from scripts/book/prompts/chapterflow-v21-authored
   npx tsx -e "
   import { readFileSync, readdirSync } from 'node:fs';
   const DIR = '../../../../.chapterflow/runs/rework/20260601-083527/sidecars/source';
   const files = readdirSync(DIR).filter(f=>f.endsWith('.source.json')).sort();
   let circular=0; const labels:string[]=[]; const tails=new Set<string>(); const claimSeen:Record<string,number>={};
   for (const f of files){ const s=JSON.parse(readFileSync(DIR+'/'+f,'utf8'));
     const d=(s.centralConcept?.plainDefinition||'').toLowerCase();
     if (d.includes('means applying')&&d.includes('as a visible operating rule')) circular++;
     for (const e of (s.namedExamples||[])) labels.push(e.label);
     tails.add((s.focus||'').slice(-60));
     for (const k of (s.keyClaims||[])) claimSeen[k]=(claimSeen[k]||0)+1; }
   const dupClaims=Object.values(claimSeen).filter(n=>n>1).length;
   console.log('circular concepts:', circular, '(must be 0)');
   console.log('anchor labels: unique', new Set(labels).size, 'of', labels.length, '(target: most chapters distinct)');
   console.log('distinct focus tails:', tails.size, 'of', files.length, '(target: near-1:1, no section-wide reuse)');
   console.log('key-claims reused verbatim across chapters:', dupClaims, '(must be 0)');
   "
   ```

   Targets: **circular = 0**, **key-claim reuse = 0**, anchor labels overwhelmingly distinct (the
   same entity may recur but not the same label on consecutive chapters), focus tails near-1:1.

## Done condition

- All 88 sidecars re-grounded in real chapter content with chapter-specific named examples.
- toc.json + index unchanged (titles still correct).
- `check-source rework` → 0/0/0, **AND** the four extra-check targets met.

Report back: the `check-source` result, plus the four numbers from the extra-check scan
(circular concepts, unique/total anchor labels, distinct focus tails, reused key-claims).
