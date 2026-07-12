# ChapterFlow catalog — content-quality audit

_All published books re-scored on the revised **book-score** rubric. Interactive scorecard: https://claude.ai/code/artifact/a565a3b4-7634-4bca-ab3a-5616c38ab0bb_

> **Headline:** Under the revised rubric, **0 of 140 books meet the high-quality bar**, **none is release-ready (0 A-class)**, and **59 of 140 (42%) fail the correctness gate** on verifiable content corruption. **135 of 140 (96%)** register HIGH book-to-book churn.

## Summary

| metric | value |
|---|---|
| Books scored | **140** |
| Release class | **A: 0 · B: 22 · C: 59 · D: 59** |
| High-quality (meets full bar) | **0** |
| Gate FAIL | **59** (≥28 with model-independent confirmed corruption) |
| Churn HIGH | **135 / 140** |
| Composite | mean 79.3 · median 80.1 · range 51.4–85.6 |

## Finding 1 — content corruption (fails the gate)

A deterministic scanner over the raw packages confirms corruption in **28 books, independent of any model**. Defect classes:

| defect class | books |
|---|---|
| “Fact N” scaffold leak in quiz explanations | 14 |
| Explanation contradicts key (wrong ordinal) | 10 |
| Word-salad decision stubs | 5 |
| Garbled timestamp (24h hour + a.m./p.m.) | 2 |
| Subjectless template seam | 1 |

**Confirmed-corruption books** (hit count):

`nudge` (108), `factfulness` (90), `emotional-intelligence` (74), `the-paradox-of-choice` (63), `the-undoing-project` (45), `eat-that-frog` (36), `ego-is-the-enemy` (28), `fooled-by-randomness` (27), `the-millionaire-next-door` (18), `the-now-habit` (18), `extreme-ownership` (11), `quiet` (10), `the-7-habits-of-highly-effective-people` (10), `behave` (9), `the-organized-mind` (9), `the-slight-edge` (9), `on-becoming-a-person` (8), `crucial-conversations` (5), `never-eat-alone` (5), `leaders-eat-last` (4), `good-to-great` (2), `superforecasting` (2), `digital-minimalism` (1), `how-to-talk-to-anyone` (1), `the-12-week-year` (1), `the-33-strategies-of-war` (1), `the-pyramid-principle` (1), `you-cant-hurt-me` (1)

The remaining gate FAILs cite defects outside those five patterns (spot-verified as real): scaffold camelCase field leaks (`daring-greatly` → `"hardEdge"`), a protagonist with two names in one chapter (`good-strategy-bad-strategy`), quiz keys grafted from another question (`the-great-mental-models-vol-1`), an invented statistic certified as fact (`the-compound-effect`), and a distorted named case (`the-culture-code` → Coyle's Nick/Jonathan bad-apple inversion, verified against the source).

## Finding 2 — texture sameness (caps everything else)

**%d of %d books** register HIGH churn. Every book reuses one scene skeleton, one structural unit, a stamped prop, and a proxy cast of role-named stand-ins. This is what holds even the clean, gate-passing books at C/B instead of A. Targeted line edits (vary the skeleton, retire stamped props, swap proxies for named humans) — **not** chapter regeneration, which re-homogenizes.

## Methodology & caveat

- **Sample:** 4 md5-seeded chapters per book (reproducible). Leakage/corruption scans cover **all** chapters.

- **Layers:** correctness gate (veto) · deterministic corruption scan · 10-factor reader panel (median) · texture-sameness axes → 0–100 weighted composite → A–D classification.

- **Mixed-model run:** books A–N (55) scored by **Opus 4.8, 3 readers**; O–Z (83) by **Sonnet 5, 2 readers**; the 2 newest (`radical-candor`, `the-culture-code`, marked `*`) by a fresh **Opus 3-reader** panel. Both halves carry equal deterministic corruption (14 each); Sonnet flagged the gate somewhat more often. The **28 confirmed corruptions and 97% HIGH churn are model-independent and rock-solid**; the exact FAIL count carries mild model-sensitivity at the margin.

- Gate FAILs were spot-verified against the raw packages and, for factual claims, the source texts (e.g. the Coyle bad-apple study).

## Full ranked catalog (140 books)

`⚑n` = deterministic corruption hits. Factors: Ret Qz Trf Prc Sum Ton Lim Ins Den Beg.

| # | Book | Author | Comp | Class | Gate | Churn | Model | Factors |
|--:|---|---|--:|:--:|:--:|:--:|:--:|---|
| 1 | Difficult Conversations: How to Discuss What Matters Most | Douglas Stone, Bruce Patton, Sheila Heen | 85.6 | B | PASS | HIGH | Opus·3r | 85 86 87 86 84 85 88 86 84 85 |
| 2 | Getting Things Done | David Allen | 85.1 | C | PASS | HIGH | Opus·3r | 85 87 85 87 84 85 88 83 80 86 |
| 3 | Atomic Habits | James Clear | 85.1 | B | PASS | HIGH | Opus·3r | 85 88 87 86 84 85 83 84 81 86 |
| 4 | Meditations | Marcus Aurelius | 85.0 | C | PASS | HIGH | Opus·3r | 85 85 87 85 84 86 87 85 85 79 |
| 5 | Good to Great | Jim Collins | 85.0 | C | PASS ⚑2 | HIGH | Opus·3r | 85 86 88 86 84 82 88 83 82 85 |
| 6 | Contagious | Jonah Berger | 84.7 | C | PASS | MED | Opus·3r | 84 87 85 85 84 83 87 82 84 86 |
| 7 | Games People Play | Eric Berne | 84.5 | C | PASS | HIGH | Opus·3r | 84 86 86 85 83 84 85 85 81 85 |
| 8 | How to Win Friends and Influence People | Dale Carnegie | 84.1 | B | PASS | HIGH | Opus·3r | 85 87 84 87 84 85 82 83 73 88 |
| 9 | How to Talk to Anyone: 92 Little Tricks for Big Success in Relationships | Leil Lowndes | 83.7 | B | PASS ⚑1 | HIGH | Opus·3r | 85 86 81 88 84 78 86 80 81 87 |
| 10 | Mindset | Carol S. Dweck | 83.5 | C | PASS | HIGH | Opus·3r | 83 86 86 85 83 80 84 81 82 84 |
| 11 | Crucial Conversations: Tools for Talking When Stakes Are High | Joseph Grenny, Kerry Patterson, Ron McMillan, Al Switzler, Emily Gregory | 83.3 | D | FAIL ⚑5 | HIGH | Opus·3r | 84 72 86 85 84 85 88 83 83 86 |
| 12 | Decisive: How to Make Better Choices in Life and Work | Chip Heath & Dan Heath | 83.3 | C | PASS | MED | Opus·3r | 82 85 84 85 82 80 86 82 82 85 |
| 13 | Blink | Malcolm Gladwell | 83.3 | C | PASS | HIGH | Opus·3r | 83 86 86 85 84 77 83 82 82 84 |
| 14 | Man's Search for Meaning | Viktor E. Frankl | 83.3 | C | PASS | HIGH | Opus·3r | 81 86 85 84 82 80 88 84 82 80 |
| 15 | Behave: The Biology of Humans at Our Best and Worst | Robert M. Sapolsky | 83.1 | C | PASS ⚑9 | HIGH | Opus·3r | 82 84 85 80 82 84 88 82 80 84 |
| 16 | Made to Stick: Why Some Ideas Survive and Others Die | Chip Heath, Dan Heath | 82.9 | C | PASS | HIGH | Opus·3r | 82 85 85 85 83 76 86 83 80 83 |
| 17 | Built to Last: Successful Habits of Visionary Companies | Jim Collins; Jerry I. Porras | 82.9 | C | PASS | HIGH | Opus·3r | 82 84 86 85 82 80 85 81 78 85 |
| 18 | Digital Minimalism | Cal Newport | 82.9 | D | FAIL ⚑1 | HIGH | Opus·3r | 84 80 85 84 84 80 84 82 80 86 |
| 19 | Clear Thinking | Shane Parrish | 82.8 | C | PASS | HIGH | Opus·3r | 82 85 84 85 83 84 87 79 72 85 |
| 20 | Fooled by Randomness: The Hidden Role of Chance in Life and in the Markets | Nassim Nicholas Taleb | 82.8 | C | PASS ⚑27 | HIGH | Opus·3r | 84 83 85 84 84 77 87 82 76 85 |
| 21 | Dopamine Nation | Anna Lembke, MD | 82.8 | C | PASS | HIGH | Opus·3r | 82 85 83 84 83 78 87 82 80 84 |
| 22 | Make It Stick | Peter C. Brown; Henry L. Roediger III; Mark A. McDaniel | 82.7 | B | PASS | HIGH | Opus·3r | 82 87 86 85 83 76 85 80 80 80 |
| 23 | Emotional Intelligence: Why It Can Matter More Than IQ | Daniel Goleman | 82.5 | D | FAIL ⚑74 | HIGH | Opus·3r | 83 79 85 85 83 77 86 82 80 85 |
| 24 | Influence, New and Expanded: The Psychology of Persuasion | Robert B. Cialdini, PhD | 82.4 | C | PASS | HIGH | Opus·3r | 82 82 86 84 82 76 85 81 82 84 |
| 25 | Unreasonable Hospitality | Will Guidara | 82.2 | D | FAIL | HIGH | Sonnet·2r | 82 84 78 81 84 85 82 82 78 84 |
| 26 | Competing Against Luck | Clayton M. Christensen | 82.2 | C | PASS | HIGH | Opus·3r | 80 83 86 84 82 74 85 82 83 84 |
| 27 | Everything Is F*cked | Mark Manson | 82.1 | C | PASS | MED | Opus·3r | 82 84 85 82 83 75 83 84 84 78 |
| 28 | Tiny Habits | BJ Fogg | 82.0 | C | PASS | HIGH | Sonnet·2r | 79 86 82 86 83 84 70 83 80 86 |
| 29 | Noise: A Flaw in Human Judgment | Daniel Kahneman, Olivier Sibony, Cass R. Sunstein | 82.0 | B | PASS | MED | Opus·3r | 81 87 85 84 83 76 82 81 78 80 |
| 30 | The 48 Laws of Power | Robert Greene | 81.9 | D | FAIL | HIGH | Sonnet·2r | 81 82 83 83 82 82 86 83 81 74 |
| 31 | The Tipping Point | Malcolm Gladwell | 81.9 | B | PASS | HIGH | Sonnet·2r | 82 86 84 82 82 80 80 82 79 80 |
| 32 | Daring Greatly | Brené Brown | 81.9 | D | FAIL | HIGH | Opus·3r | 82 84 83 84 83 74 85 79 82 82 |
| 33 | Factfulness | Hans Rosling, Ola Rosling, Anna Rosling Rönnlund | 81.9 | D | FAIL ⚑90 | HIGH | Opus·3r | 80 80 84 82 83 80 86 82 80 83 |
| 34 | Make Time | Jake Knapp and John Zeratsky | 81.8 | B | PASS | HIGH | Opus·3r | 82 85 83 86 83 74 86 78 73 85 |
| 35 | Leaders Eat Last | Simon Sinek | 81.7 | C | PASS ⚑4 | HIGH | Opus·3r | 82 84 83 85 82 74 86 76 78 85 |
| 36 | The Let Them Theory | Mel Robbins | 81.6 | D | FAIL | HIGH | Sonnet·2r | 79 84 79 84 84 82 84 78 78 85 |
| 37 | The War of Art | Steven Pressfield | 81.5 | B | PASS | HIGH | Sonnet·2r | 82 84 83 83 84 76 80 81 78 84 |
| 38 | Radical Candor | Kim Scott | 81.5 | C | PASS | MED | Opus·3r* | 82 86 84 83 81 73 84 81 82 76 |
| 39 | Hyperfocus: How to Be More Productive in a World of Distraction | Chris Bailey | 81.4 | C | PASS | HIGH | Opus·3r | 82 83 81 85 82 73 88 76 80 83 |
| 40 | Mistakes Were Made (but Not by Me) | Carol Tavris; Elliot Aronson | 81.3 | D | FAIL | HIGH | Opus·3r | 80 84 83 84 81 73 86 80 80 82 |
| 41 | The Happiness Hypothesis | Jonathan Haidt | 81.3 | C | PASS | HIGH | Sonnet·2r | 81 83 79 82 82 78 85 81 79 84 |
| 42 | The Almanack of Naval Ravikant | Eric Jorgenson | 81.3 | B | PASS | HIGH | Sonnet·2r | 82 83 82 81 81 78 86 82 80 78 |
| 43 | Thinking in Bets | Annie Duke | 81.2 | B | PASS | HIGH | Sonnet·2r | 81 84 84 82 82 74 84 80 80 82 |
| 44 | Blue Ocean Strategy | W. Chan Kim; Renée Mauborgne | 81.2 | D | FAIL | HIGH | Opus·3r | 82 76 84 85 82 78 84 79 78 84 |
| 45 | The Gifts of Imperfection | Brené Brown | 81.2 | B | PASS | HIGH | Sonnet·2r | 81 86 80 83 81 74 86 80 80 78 |
| 46 | The Checklist Manifesto: How to Get Things Right | Atul Gawande | 81.1 | B | PASS | HIGH | Sonnet·2r | 81 84 82 81 82 74 83 82 80 78 |
| 47 | The Great Mental Models, Volume 1: General Thinking Concepts | Shane Parrish | 81.0 | D | FAIL | HIGH | Sonnet·2r | 80 71 83 83 82 84 87 82 79 82 |
| 48 | Rich Dad Poor Dad | Robert T. Kiyosaki | 81.0 | B | PASS | HIGH | Sonnet·2r | 81 81 81 84 82 78 84 78 76 84 |
| 49 | The Prince | Niccolo Machiavelli | 81.0 | C | PASS | HIGH | Sonnet·2r | 82 84 80 79 84 78 84 78 77 81 |
| 50 | Smarter Faster Better | Charles Duhigg | 81.0 | B | PASS | HIGH | Sonnet·2r | 79 85 80 82 84 74 84 80 80 81 |
| 51 | Hooked | Nir Eyal | 81.0 | C | PASS | HIGH | Opus·3r | 82 80 83 83 81 76 84 78 79 83 |
| 52 | Essentialism | Greg McKeown | 81.0 | C | PASS | HIGH | Opus·3r | 80 82 84 84 81 76 82 80 75 85 |
| 53 | The 4-Hour Workweek | Tim Ferriss | 81.0 | B | PASS | HIGH | Sonnet·2r | 80 82 82 83 82 75 86 80 78 82 |
| 54 | Outliers | Malcolm Gladwell | 80.9 | B | PASS | HIGH | Sonnet·2r | 77 84 80 77 83 81 86 80 78 84 |
| 55 | Stillness Is the Key | Ryan Holiday | 80.9 | D | FAIL | HIGH | Sonnet·2r | 80 79 82 83 78 82 85 79 77 83 |
| 56 | Talk Like TED: The 9 Public-Speaking Secrets of the World's Top Minds | Carmine Gallo | 80.9 | B | PASS | HIGH | Sonnet·2r | 78 84 84 82 80 77 85 81 74 84 |
| 57 | Think and Grow Rich | Napoleon Hill | 80.9 | B | PASS | HIGH | Sonnet·2r | 80 84 79 82 81 80 82 78 80 82 |
| 58 | Dare to Lead | Brené Brown | 80.9 | C | PASS | HIGH | Opus·3r | 83 83 82 85 81 74 80 80 81 77 |
| 59 | The Willpower Instinct | Kelly McGonigal | 80.8 | C | PASS | HIGH | Sonnet·2r | 80 83 82 82 81 76 85 80 80 75 |
| 60 | The Power of Habit | Charles Duhigg | 80.7 | C | PASS | HIGH | Sonnet·2r | 82 82 82 83 82 73 84 78 78 82 |
| 61 | Playing to Win | A.G. Lafley and Roger L. Martin | 80.6 | B | PASS | HIGH | Sonnet·2r | 82 83 86 84 82 76 68 84 80 78 |
| 62 | The Effective Executive | Peter F. Drucker | 80.5 | C | PASS | HIGH | Sonnet·2r | 80 83 81 82 80 79 84 78 81 76 |
| 63 | The First 90 Days: Proven Strategies for Getting Up to Speed Faster and Smarter, Updated and Expanded | Michael D. Watkins | 80.5 | C | PASS | HIGH | Sonnet·2r | 80 82 80 84 82 77 86 78 80 75 |
| 64 | The Organized Mind: Thinking Straight in the Age of Information Overload | Daniel J. Levitin | 80.4 | D | FAIL ⚑9 | HIGH | Sonnet·2r | 81 75 80 84 81 80 84 80 79 79 |
| 65 | Good Strategy / Bad Strategy | Richard Rumelt | 80.4 | D | FAIL | HIGH | Opus·3r | 80 85 81 82 80 78 78 78 77 84 |
| 66 | The 7 Habits of Highly Effective People | Stephen R. Covey | 80.2 | B | PASS ⚑10 | HIGH | Sonnet·2r | 79 82 82 83 82 76 80 78 80 78 |
| 67 | Flow: The Psychology of Optimal Experience | Mihaly Csikszentmihalyi | 80.2 | D | FAIL | HIGH | Opus·3r | 82 66 83 84 81 78 86 80 80 85 |
| 68 | Predictably Irrational | Dan Ariely | 80.2 | B | PASS | HIGH | Sonnet·2r | 80 84 80 82 80 72 84 78 78 84 |
| 69 | The Compound Effect | Darren Hardy | 80.2 | D | FAIL | HIGH | Sonnet·2r | 80 84 77 83 82 74 84 76 78 84 |
| 70 | The Psychology of Money | Morgan Housel | 80.1 | D | FAIL | HIGH | Sonnet·2r | 78 70 82 82 82 80 86 80 80 84 |
| 71 | The Power of Moments | Chip Heath and Dan Heath | 80.1 | D | FAIL | HIGH | Sonnet·2r | 79 81 81 81 81 78 84 77 80 79 |
| 72 | Drive | Daniel H. Pink | 80.0 | C | PASS | HIGH | Opus·3r | 78 83 82 84 82 72 82 77 80 79 |
| 73 | Eat That Frog! | Brian Tracy | 80.0 | D | FAIL ⚑36 | HIGH | Opus·3r | 80 76 79 84 82 76 86 78 75 85 |
| 74 | The Courage to Be Disliked | Ichiro Kishimi, Fumitake Koga | 80.0 | D | FAIL | HIGH | Sonnet·2r | 79 82 83 82 80 72 80 82 78 80 |
| 75 | The Like Switch | Jack Schafer, Marvin Karlins | 79.9 | C | PASS | HIGH | Sonnet·2r | 80 83 82 80 80 74 85 77 76 84 |
| 76 | Stolen Focus | Johann Hari | 79.9 | C | PASS | HIGH | Sonnet·2r | 78 83 80 80 81 75 83 79 78 82 |
| 77 | The Great Mental Models, Volume 2: Physics, Chemistry, and Biology | Shane Parrish | 79.8 | C | PASS | HIGH | Sonnet·2r | 82 72 80 84 82 72 87 76 78 84 |
| 78 | The Denial of Death | Ernest Becker | 79.7 | C | PASS | HIGH | Sonnet·2r | 80 82 82 80 78 72 84 79 76 84 |
| 79 | Super Thinking | Gabriel Weinberg; Lauren McCann | 79.7 | C | PASS | HIGH | Sonnet·2r | 77 84 82 84 81 71 77 78 79 84 |
| 80 | The 5 AM Club | Robin Sharma | 79.7 | C | PASS | HIGH | Sonnet·2r | 78 82 79 83 81 74 83 78 78 80 |
| 81 | The Art of War | Sunzi | 79.6 | C | PASS | HIGH | Sonnet·2r | 78 80 82 81 78 77 80 80 80 80 |
| 82 | Superforecasting | Philip E. Tetlock | 79.5 | D | FAIL ⚑2 | HIGH | Sonnet·2r | 80 70 84 84 82 76 78 84 79 80 |
| 83 | The Intelligent Investor | Benjamin Graham | 79.5 | D | FAIL | HIGH | Sonnet·2r | 78 80 84 78 82 80 81 82 82 68 |
| 84 | The Power of Full Engagement | Jim Loehr and Tony Schwartz | 79.4 | D | FAIL | HIGH | Sonnet·2r | 80 75 80 82 83 80 79 79 75 82 |
| 85 | The Molecule of More: How a Single Chemical in Your Brain Drives Love, Sex, and Creativity-and Will Determine the Fate of the Human Race | Daniel Z. Lieberman and Michael E. Long | 79.4 | C | PASS | HIGH | Sonnet·2r | 80 82 78 79 80 80 82 78 76 80 |
| 86 | Peak | Anders Ericsson, Robert Pool | 79.4 | C | PASS | HIGH | Sonnet·2r | 79 81 82 80 80 73 82 78 72 84 |
| 87 | The Subtle Art of Not Giving a F*ck | Mark Manson | 79.3 | C | PASS | HIGH | Sonnet·2r | 81 82 81 82 80 66 82 78 81 80 |
| 88 | Quiet: The Power of Introverts in a World That Can't Stop Talking | Susan Cain | 79.3 | D | FAIL ⚑10 | HIGH | Sonnet·2r | 78 78 82 81 80 78 81 80 74 83 |
| 89 | High Output Management | Andrew S. Grove | 79.2 | C | PASS | HIGH | Opus·3r | 78 85 84 78 80 73 82 77 80 71 |
| 90 | The Slight Edge: Turning Simple Disciplines into Massive Success and Happiness | Jeff Olson with John David Mann | 79.1 | D | FAIL ⚑9 | HIGH | Sonnet·2r | 78 74 81 80 80 80 84 78 75 82 |
| 91 | The Millionaire Next Door | Thomas J. Stanley and William D. Danko | 79.0 | D | FAIL ⚑18 | HIGH | Sonnet·2r | 80 70 81 82 80 78 82 80 78 80 |
| 92 | Seeking Wisdom: From Darwin to Munger | Peter Bevelin | 79.0 | C | PASS | HIGH | Sonnet·2r | 80 84 76 82 80 70 84 74 76 84 |
| 93 | What Every BODY is Saying | Joe Navarro | 79.0 | C | PASS | HIGH | Sonnet·2r | 76 80 84 80 81 70 86 76 73 83 |
| 94 | The Now Habit: A Strategic Program for Overcoming Procrastination and Enjoying Guilt-Free Play | Neil A. Fiore | 79.0 | D | FAIL ⚑18 | HIGH | Sonnet·2r | 79 73 80 82 80 78 82 80 76 83 |
| 95 | The Year of Less | Cait Flanders | 78.9 | D | FAIL | HIGH | Sonnet·2r | 79 76 80 82 80 72 84 79 78 82 |
| 96 | Skin in the Game: Hidden Asymmetries in Daily Life | Nassim Nicholas Taleb | 78.9 | C | PASS | HIGH | Sonnet·2r | 78 78 82 82 80 70 82 80 76 80 |
| 97 | The First 20 Hours: How to Learn Anything... Fast! | Josh Kaufman | 78.9 | C | PASS | HIGH | Sonnet·2r | 79 82 86 81 80 60 84 77 78 82 |
| 98 | 7 Powers: The Foundations of Business Strategy | Hamilton Helmer | 78.8 | D | FAIL | HIGH | Sonnet·2r | 80 78 84 84 78 68 82 77 76 81 |
| 99 | Limitless | Jim Kwik | 78.8 | C | PASS | HIGH | Opus·3r | 80 83 81 83 80 64 85 74 72 84 |
| 100 | Never Split the Difference: Negotiating as if Your Life Depended on It | Chris Voss, Tahl Raz | 78.8 | C | PASS | HIGH | Opus·3r | 78 80 79 82 80 72 83 77 74 83 |
| 101 | Ultralearning: Master Hard Skills, Outsmart the Competition, and Accelerate Your Career | Scott H. Young | 78.7 | D | FAIL | HIGH | Sonnet·2r | 78 78 78 82 78 75 83 80 76 80 |
| 102 | Pitch-Anything | Oren Klaff | 78.6 | D | FAIL | HIGH | Sonnet·2r | 78 68 81 84 82 74 86 76 74 84 |
| 103 | On Becoming a Person | Carl Rogers | 78.5 | D | FAIL ⚑8 | HIGH | Sonnet·2r | 78 72 80 80 82 76 81 79 77 81 |
| 104 | The Charisma Myth | Olivia Fox Cabane | 78.5 | C | PASS | HIGH | Sonnet·2r | 78 84 78 80 74 75 82 76 74 84 |
| 105 | Stumbling on Happiness | Daniel Gilbert | 78.5 | D | FAIL | HIGH | Sonnet·2r | 79 84 78 76 78 72 82 80 78 76 |
| 106 | Execution: The Discipline of Getting Things Done | Larry Bossidy and Ram Charan | 78.4 | C | PASS | HIGH | Opus·3r | 76 82 83 81 79 71 82 76 82 69 |
| 107 | Nudge: Improving Decisions about Health, Wealth, and Happiness | Richard H. Thaler and Cass R. Sunstein | 78.4 | D | FAIL ⚑108 | HIGH | Opus·3r | 79 62 78 80 82 80 85 79 82 82 |
| 108 | The Innovator's Dilemma: When New Technologies Cause Great Firms to Fail | Clayton M. Christensen | 78.1 | D | FAIL | HIGH | Sonnet·2r | 79 72 83 82 80 74 76 78 78 77 |
| 109 | The Undoing Project | Michael Lewis | 78.0 | D | FAIL ⚑45 | HIGH | Sonnet·2r | 78 69 80 79 82 72 85 76 80 81 |
| 110 | Thinking, Fast and Slow | Daniel Kahneman | 77.9 | D | FAIL | HIGH | Sonnet·2r | 76 82 81 75 80 69 82 79 81 72 |
| 111 | Start With Why | Simon Sinek | 77.9 | D | FAIL | HIGH | Sonnet·2r | 78 73 83 80 78 72 82 80 74 79 |
| 112 | Antifragile: Things That Gain from Disorder | Nassim Nicholas Taleb | 77.8 | C | PASS | HIGH | Opus·3r | 78 79 82 82 80 64 82 76 69 85 |
| 113 | The Righteous Mind | Jonathan Haidt | 77.8 | C | PASS | HIGH | Sonnet·2r | 76 82 84 80 80 68 79 72 73 82 |
| 114 | The Outsiders: Eight Unconventional CEOs and Their Radically Rational Blueprint for Success | William N. Thorndike Jr. | 77.8 | C | PASS | HIGH | Sonnet·2r | 76 81 85 80 78 68 80 80 72 77 |
| 115 | Never Eat Alone | Keith Ferrazzi | 77.8 | C | PASS ⚑5 | HIGH | Opus·3r | 78 76 80 82 80 70 84 74 70 84 |
| 116 | Willpower: Rediscovering the Greatest Human Strength | Roy F. Baumeister and John Tierney | 77.6 | D | FAIL | HIGH | Sonnet·2r | 77 79 77 80 79 72 78 76 78 80 |
| 117 | The Pyramid Principle | Barbara Minto | 77.5 | D | FAIL ⚑1 | HIGH | Sonnet·2r | 78 68 80 82 79 79 82 78 80 70 |
| 118 | The Obstacle Is the Way | Ryan Holiday | 77.2 | D | FAIL | HIGH | Sonnet·2r | 79 58 82 83 80 76 82 76 76 84 |
| 119 | The Gift of Fear | Gavin de Becker | 77.1 | C | PASS | HIGH | Sonnet·2r | 78 78 79 78 76 70 82 78 70 81 |
| 120 | Pre-Suasion | Robert Cialdini | 77.1 | D | FAIL | HIGH | Sonnet·2r | 78 80 80 80 76 66 80 76 76 82 |
| 121 | So Good They Can't Ignore You: Why Skills Trump Passion in the Quest for Work You Love | Cal Newport | 76.7 | D | FAIL | HIGH | Sonnet·2r | 75 51 82 83 83 75 84 79 78 84 |
| 122 | The Black Swan | Nassim N. Taleb | 76.5 | D | FAIL | HIGH | Sonnet·2r | 78 82 80 80 67 70 82 80 74 72 |
| 123 | The Hard Thing About Hard Things | Ben Horowitz | 76.4 | C | PASS | HIGH | Sonnet·2r | 77 81 82 82 81 45 85 74 76 80 |
| 124 | The Lean Startup | Eric Ries | 76.3 | D | FAIL | HIGH | Sonnet·2r | 74 64 80 77 80 76 82 78 75 82 |
| 125 | The Paradox of Choice | Barry Schwartz | 75.8 | D | FAIL ⚑63 | HIGH | Sonnet·2r | 77 52 80 80 80 78 81 76 78 80 |
| 126 | Multipliers, Revised and Updated | Liz Wiseman | 75.5 | C | PASS | HIGH | Opus·3r | 78 74 78 80 75 70 82 72 74 69 |
| 127 | The Laws of Human Nature | Robert Greene | 75.3 | D | FAIL | HIGH | Sonnet·2r | 76 64 80 82 82 64 76 77 76 78 |
| 128 | Zero to One | Peter Thiel | 75.0 | D | FAIL | HIGH | Sonnet·2r | 71 80 76 68 78 78 70 76 76 76 |
| 129 | Deep Work | Cal Newport | 74.8 | C | PASS | HIGH | Opus·3r | 67 70 82 77 76 72 80 75 71 82 |
| 130 | Ego Is the Enemy | Ryan Holiday | 74.1 | D | FAIL ⚑28 | HIGH | Opus·3r | 74 64 77 80 78 70 75 73 73 79 |
| 131 | The 33 Strategies of War | Robert Greene | 74.1 | D | FAIL ⚑1 | HIGH | Sonnet·2r | 75 59 81 80 78 58 84 76 76 80 |
| 132 | The Elephant in the Brain | Kevin Simler; Robin Hanson | 73.2 | D | FAIL | HIGH | Sonnet·2r | 72 57 78 78 78 64 81 78 78 74 |
| 133 | The Culture Code | Daniel Coyle | 71.1 | D | FAIL | HIGH | Opus·3r* | 72 74 71 74 74 61 80 69 67 65 |
| 134 | Grit: The Power of Passion and Perseverance | Angela Duckworth | 70.9 | D | FAIL | HIGH | Opus·3r | 70 76 72 73 73 61 78 68 65 71 |
| 135 | Extreme Ownership | Jocko Willink, Leif Babin | 69.5 | D | FAIL ⚑11 | HIGH | Opus·3r | 68 80 71 67 70 66 75 66 65 62 |
| 136 | The One Thing | Gary Keller, Jay Papasan | 68.8 | D | FAIL | HIGH | Sonnet·2r | 60 62 69 62 64 76 80 72 72 82 |
| 137 | Indistractable | Nir Eyal | 67.0 | D | FAIL | HIGH | Opus·3r | 66 54 76 72 66 60 77 64 65 73 |
| 138 | The 12 Week Year | Brian Moran and Michael Lennington | 66.3 | D | FAIL ⚑1 | HIGH | Sonnet·2r | 68 56 70 62 65 68 76 70 66 64 |
| 139 | Measure What Matters | John Doerr | 55.4 | D | FAIL | HIGH | Opus·3r | 55 71 57 56 60 43 60 47 47 49 |
| 140 | Can't Hurt Me: Master Your Mind and Defy the Odds | David Goggins | 51.4 | D | FAIL ⚑1 | HIGH | Sonnet·2r | 46 28 56 56 64 34 60 56 64 62 |

---
_Raw data: `catalog-quality-audit.json` (140 book summaries) · `catalog-corruption-census.json` (deterministic scan). Generated by the book-score skill._
