# Games People Play — Chapter Map

This document maps Berne's original book structure to the teaching structure the
ChapterFlow orchestrator should derive. The original book has three parts; the
ChapterFlow package should flatten these into a linear chapter sequence optimized
for modern readers.

## Original book structure (1964 edition)

**Introduction**
- Social Intercourse (the problem of stimulus hunger and time structuring)
- Time Structuring (six ways people fill time with each other)

**Part I — Analysis of Games**
1. Structural Analysis (ego states: Parent, Adult, Child)
2. Transactional Analysis (complementary, crossed, ulterior transactions)
3. Procedures and Rituals
4. Pastimes
5. Games (formal definition, thesis, antithesis, advantages, classification)

**Part II — A Thesaurus of Games**
6. Life Games
7. Marital Games
8. Party Games
9. Sexual Games
10. Underworld Games
11. Consulting Room Games
12. Good Games

**Part III — Beyond Games**
13. The Significance of Games
14. The Players
15. A Paradigm (a worked example)
16. Autonomy
17. The Attainment of Autonomy
18. After Games, What?

## Recommended ChapterFlow teaching structure

The orchestrator should consolidate Berne's 18 chapters into roughly 10 teaching
chapters. The rationale is that several of Berne's chapters are very short (under
five pages) and several of the Part III chapters cover the same closing idea.

### Chapter 1 — The Three Voices Inside You
**Covers:** Structural Analysis (Berne's Chapter 1)
**Teaching focus:** Make the Parent/Adult/Child model practical. Show readers how
to notice which voice is speaking in themselves and others. Move quickly past the
"three" count and spend time on the *flavor* of each state.
**Modern examples to generate:** A manager critiquing work email (Parent), the
same manager processing a budget spreadsheet (Adult), the same manager reacting
to a personal insult (Child). The point: one person, three states, within five
minutes.
**Avoid:** Confusing this with Freud's id/ego/superego. Berne's states are
behavioral, not theoretical.

### Chapter 2 — What a Transaction Is and Why They Go Wrong
**Covers:** Transactional Analysis (Berne's Chapter 2) up through crossed transactions
**Teaching focus:** The complementary/crossed distinction is the most immediately
useful tool in the book. Readers should leave this chapter able to spot a crossed
transaction in real time.
**Modern examples to generate:** A remote-work Slack exchange that goes sideways;
a dinner-table conversation that derails; a customer service call where both
sides are speaking from different ego states.

### Chapter 3 — Ulterior Transactions and the Anatomy of a Game
**Covers:** The ulterior transaction concept (end of Berne's Chapter 2) plus Chapter 5
(the formal definition of a game)
**Teaching focus:** The "two levels at once" idea. What people say versus what
they mean. Introduce the six-advantage analysis without getting bogged down in it.
**Modern examples to generate:** A workplace compliment that is really a dig;
a partner's "sure, do what you want" that is not a sincere concession.

### Chapter 4 — Why Games Feel So Hard to Stop
**Covers:** Pastimes (Berne's Chapter 4), stroke theory, life positions, and the
reason games persist
**Teaching focus:** The stickiness of games is the whole book's hinge. Readers who
understand that games pay off — even with bad feelings — stop trying to shame
themselves or others out of them.
**Modern examples to generate:** The "commiserate about the boss" conversation
that keeps friendships alive; the morning complaint ritual with a spouse.

### Chapter 5 — The Life Games
**Covers:** Berne's Chapter 6 (Life Games)
**Games to include:** Alcoholic, Debtor, Kick Me, NIGYSOB, See What You Made Me Do
**Teaching focus:** These are the big, expensive games that shape lives. For each,
provide the thesis, the typical payoff, and the antithesis. Emphasize that "Alcoholic"
here is a social-role analysis, not a clinical treatment approach for addiction.

### Chapter 6 — Marital Games
**Covers:** Berne's Chapter 7 (Marital Games), updated for modern relationships
**Games to include:** Corner, Courtroom, If It Weren't For You, Look How Hard I've
Tried, Sweetheart, and a modernized version of Frigid Woman (framed as
intimacy-avoidance, non-gendered)
**Teaching focus:** The underlying pattern is almost always intimacy-avoidance.
Readers in relationships should be able to identify one game they play.
**Note:** This chapter needs the most modernization. The 1964 gendered framings
should be replaced with current-day, relationship-neutral language.

### Chapter 7 — Party and Social Games
**Covers:** Berne's Chapter 8 (Party Games), with digital-age extensions
**Games to include:** Ain't It Awful, Blemish, Schlemiel, Why Don't You Yes But
**Teaching focus:** These games are the texture of most casual social life. They
are lower-stakes than marital or life games, but they eat enormous amounts of time
and foreclose deeper contact.
**Modern extension:** Social media versions of these games — doom-scrolling as
Ain't It Awful, comment-section Blemish, "asking for advice" posts that run Why
Don't You Yes But.

### Chapter 8 — Professional and Therapy-Room Games
**Covers:** Berne's Chapters 10 (Underworld Games, selected) and 11 (Consulting Room)
**Games to include:** I'm Only Trying to Help You, Wooden Leg, Stupid, Greenhouse,
How Do You Get Out of Here (framed for modern equivalents: any institutional exit)
**Teaching focus:** How games run in professional helping relationships — therapy,
coaching, management, teaching. Both sides can play. The helper who needs the
recipient to stay in need is running a game too.

### Chapter 9 — The Games Worth Keeping
**Covers:** Berne's Chapter 12 (Good Games)
**Games to include:** Busman's Holiday, Cavalier, Happy to Help, Homely Sage,
They'll Be Glad They Knew Me
**Teaching focus:** Games are not inherently bad. Some of the most productive and
generous patterns in adult life are technically games by Berne's definition. The
goal is not a game-free life; it is a life whose games contribute more than they
cost.

### Chapter 10 — What Comes After Games
**Covers:** Berne's Chapters 13–18 (all of Part III)
**Teaching focus:** Autonomy — awareness, spontaneity, intimacy. This is the
book's closing argument and should be the package's closing chapter. It is a
directional chapter, not a how-to; the point is that becoming able to stop
playing games is a long practice, not a technique.
**Avoid:** Turning this into a life-coach manifesto. Berne was clinical; the
chapter should honor the difficulty of the practice it describes.

## Skeleton dossier notes

For the orchestrator's skeleton/ artifacts, each chapter should include:

- **Core concept** (one sentence)
- **Three examples** (modern, non-gendered, including at least one workplace scenario)
- **Tone object**: gentle, direct, competitive variants where applicable
- **Three-depth variants**: easy (what it is), medium (how to spot it), hard
  (the antithesis move and why it's uncomfortable)
- **Recognition test**: a short scenario the reader can diagnose
- **Transition**: how this chapter sets up the next one

## Variant family

`variantFamily: "EMH"` (Easy/Medium/Hard) matches the flagship_v4_compatible
output profile.

## Chapter range

Target: 10 chapters in the release package. The orchestrator is free to adjust
by ±1 if a natural break suggests a different count, but should not exceed 12.
