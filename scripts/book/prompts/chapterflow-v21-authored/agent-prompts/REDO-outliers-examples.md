# Redo (Step 2) — outliers — EXAMPLES ONLY (3-cases-padded-to-6 via name-swap)

You are the **writer (Step-2) agent**. You are doing **one** scoped edit in all 9 chapters of
*Outliers*: **rewrite the `examples` array so each chapter has 6 genuinely distinct examples.**
Nothing else in any chapter changes.

## What you change
- `examples[*].title`, `examples[*].scenario`, `examples[*].whatToDo`, `examples[*].whyItMatters`
  in every chapter — and `tags` / `planSpec` if present, so the 6 vary in format/beat.
- Keep each example's `exampleId` (ex01…ex06) so downstream references hold.

## What you do NOT change
hook, keyTakeaway, tryThisNow, breakdown (fastRead/deepRead/fullRead), quiz, reviewCards, plan,
title, metadata — **every field except the `examples` array.** Leave the toc, index, and source
sidecars untouched.

## Why this redo exists

Every chapter's 6 examples are **3 real cases padded to 6** by duplicating each scenario and
swapping the protagonist's name. Verbatim, ch01:

```
ex[0] title: "Rhiannon Studies Medicine Hat Tigers roster"   scenario: 301 chars
ex[3] title: "Arun Audits Medicine Hat Tigers roster"        scenario: the SAME 301 chars + 1 appended sentence
```

Confirmed **9/9 chapters, all 3 pairs each**: `examples[i].scenario` is a >90% prefix of
`examples[i+3].scenario`; the titles are the same case with a swapped name and a swapped verb
(Studies/Audits, Revisits/Tests, Reframes/Applies). Only `whatToDo` / `whyItMatters` differ.

**Why the gates passed it (do not repeat these tricks):**
- `A16` floors examples at **6** (fewer is a blocker) but each sidecar offers only **3** named
  anchors — so 3 got padded to 6.
- `C10` (no shared title verb) was *gamed* by giving all 6 titles different verbs.
- The duplicate appends one sentence, so the exact-string-uniqueness check sees "6 unique."
- `C8` (no Cartesian template) and the intra-book `AS7/AS9` critics check structure / *cross*-chapter
  position — a within-chapter verbatim-prefix twin slips between them.

This is the same name-swap templating `AS9` kills across chapters (see STEP-2-WRITE-CHAPTERS.md
line 137), occurring inside a chapter where no detector looks. It also caused the 39 `C2`
"scenario lacks specific setting" majors — the padded scenes are abstract.

## The target shape — copy how blink (a clean book) does it

blink ch01's 6 examples are 6 **distinct applied scenarios**, each a different protagonist,
domain, setting, and decision, each referencing a *different* real anchor:

```
"Freya marks the contempt cue"   — 8:35 a.m., Seattle counseling office, red intake folder,
                                    a Gottman love-lab note; must decide whether to…
"Sabine hears the operator's fist" — 11:12 p.m., Munich security lab, encrypted radio bursts,
                                    a Morse-code-fist note; must tell the incident lead whether…
"Dario reads the dorm residue"   — 4:20 p.m., residence-hall office, a Samuel Gosling dorm-room
                                    study; must answer before the hiring committee meets…
```

Fresh fictional protagonist + concrete time/place/role/artifact + an explicit decision + a real
source anchor referenced as the principle. **That is the bar. Match it.**

## How to get 6 DISTINCT examples from 3 source cases

You do **not** need 6 separate headline cases. You need 6 structurally different *applied
situations*. A source case is the **principle**, not the scene:
- Build a fresh contemporary scenario (different protagonist, domain, setting, decision) that
  **applies** the chapter's mental move, and reference the real Outliers case as the grounding
  analogy/study the protagonist invokes — e.g. "…the same accumulation edge that gave Bill Gates
  his Lakeside hours."
- Two examples MAY draw on the same source case **only if the scenarios are completely different
  situations** (different person, domain, setting, decision). Never the same scene retold with a
  swapped name.
- Mine the sidecar's `paraphraseNotes`, `keyClaims`, `centralConcept`, and `hardEdge` for more
  concrete material than the 3 headline labels.
- Span **6 different domains** (work, school, business, sports, health, civic, family, online…).

## Per-example rules (STEP-2-WRITE-CHAPTERS.md, Step 6 — every one matters)

1. **C1** — named protagonist; fresh, fitting the setting; NOT reused across the 6 or across other
   outliers chapters; NOT in the banned pool (Priya, Omar, Maya, Marcus, Elena, Lena, Victor, Theo,
   Jonah, Mateo, Tessa, Owen, Mira, Malik, Nadia, Felix, Caleb, Talia, Elise, Naomi). Run
   `npx tsx src/cli.ts ledger forbidden-names --book outliers` and avoid every name it lists.
2. **C2** — specific scene: a time, a place, a role, a concrete artifact. (Fixes the abstract-scene majors.)
3. **C3** — decision-point cue for decision-style formats: "must tell / must decide / minutes before / before the vote…".
4. **C8** — no two examples share a skeleton (name+role+place swapped). Each scenario structurally different.
5. **C9 / C10** — no alphabet-cycling names; don't lean on one title-verb shell (and don't game this — vary the *scene*, not just the verb).
6. **Distinct domains** across the 6; **SC9** — each scenario references a proper-noun anchor from this chapter's source notes.
7. **AS9 / AS10** — no scenario / whatToDo / whyItMatters that overlaps a prior chapter's same-position example; no stock connective phrase reused across chapters. Read prior chapters' examples first.
8. `whatToDo` = one move (one verb, one object, one reason). `whyItMatters` = the lesson, not a re-summary of the scene.
9. **Lengths:** scenario 280–520 chars; whatToDo 120–240; whyItMatters 120–240.
10. **New anti-duplication rule (the reason for this redo):** within a chapter, no example's
    scenario may be a >60% prefix/overlap of another's, and no two examples may be the same
    underlying case with a swapped protagonist name.

## Per-chapter source anchors (the real cases — apply, don't retell-twice)

| Ch | Title | Anchors (principle each example can apply) |
|---|---|---|
| 01 | The Matthew Effect | Medicine Hat Tigers roster; Jan-1 hockey cutoff; fourth-grade test gaps |
| 02 | The 10,000-Hour Rule | Bill Joy at Michigan; The Beatles in Hamburg; Bill Gates and Lakeside |
| 03 | The Trouble with Geniuses, Pt 1 | Chris Langan; Lewis Terman's Termites; basketball-height analogy |
| 04 | The Trouble with Geniuses, Pt 2 | Langan at Reed/Montana State; Robert Oppenheimer; Annette Lareau's family studies |
| 05 | The Three Lessons of Joe Flom | Joe Flom / Skadden Arps; hostile-takeover work; Louis & Regina Borgenicht |
| 06 | Harlan, Kentucky | Harlan family feuds; Scots-Irish herders; Southern insult experiments |
| 07 | The Ethnic Theory of Plane Crashes | Korean Air Flt 801; Avianca Flt 052; Suren Ratwatte; Korean Air reform |
| 08 | Rice Paddies and Math Tests | Chinese number system; South China rice paddies; persistence-and-math-scores |
| 09 | Marita's Bargain | KIPP Academy Bronx; summer learning-loss data; Marita |

## Procedure
1. Work chapter by chapter, ch01 → ch09. Rewrite all 6 examples per the rules above.
2. After each chapter: `npx tsx src/cli.ts gate-chapter state/chapters/outliers-ch{NN}.v21-native.chapter.json` → **0 blockers**, and aim to clear the chapter's `C2` majors.
3. **Mandatory extra check the gate cannot do** — within-chapter scenario duplication (run from `scripts/book/prompts/chapterflow-v21-authored`):

   ```bash
   npx tsx -e "
   import { readFileSync, readdirSync } from 'node:fs';
   function cp(a,b){let i=0;while(i<a.length&&i<b.length&&a[i]===b[i])i++;return i;}
   const files = readdirSync('state/chapters').filter(f=>f.startsWith('outliers-')&&f.endsWith('.chapter.json')).sort();
   const tone=(v)=> typeof v==='string'?v:(v?.base||v?.neutral||'');
   for (const f of files){ const ch=JSON.parse(readFileSync('state/chapters/'+f,'utf8')); const ex=ch.examples||[];
     let worst=0;
     for (let i=0;i<ex.length;i++) for (let j=i+1;j<ex.length;j++){
       const a=tone(ex[i].scenario), b=tone(ex[j].scenario);
       const r=cp(a,b)/Math.min(a.length||1,b.length||1); if(r>worst)worst=r; }
     console.log('ch'+String(ch.number).padStart(2,'0')+': worst scenario prefix-overlap '+(worst*100).toFixed(0)+'%  '+(worst>0.6?'<-- STILL DUPLICATED':'OK'));
   }
   "
   ```
   Every chapter must read **OK** (worst overlap < 60%).
4. After all 9: `npx tsx src/cli.ts book-gate outliers` → **0 blockers**, and re-run the scan above (all OK).

## Done condition
- Every chapter has 6 distinct applied examples (no scenario reuse, no name-swapped twins).
- Untouched fields verified unchanged (only `examples` differs from the prior version).
- Per-chapter `gate-chapter`: 0 blockers. `book-gate`: 0 blockers. Within-chapter scan: all OK.

Report back: per-chapter blocker count, book-gate blocker count, and the worst-overlap % per chapter.
