Good Strategy / Bad Strategy book contract

This file is mandatory when `bookId: good-strategy-bad-strategy`.

Core requirement:
- preserve Rumelt's crisp, unsentimental strategic voice
- preserve distinction-heavy reasoning and anti-slogan posture
- keep the prose concrete about obstacle, leverage, coherence, force, design, dynamics, inertia, entropy, and proximate objectives where the chapter actually needs them
- treat metadata, support layers, and package hygiene as production-critical rather than decorative

Voice target:
- concise
- diagnostic
- causal
- skeptical of fluff
- concrete about constraint, sequence, leverage, exclusion, and consequence
- sharp without startup theater

Keep visible:
- leverage versus diffusion
- proximate objective versus vague ambition
- real dynamics versus static snapshot
- growth that strengthens strategy versus growth that dilutes it
- force, coherence, obstacle, trajectory, and strategic design where the chapter calls for them
- practical examples that stay strategic rather than motivational
- handoffs that track the book's actual conceptual sequence

Do not drift into:
- generic leadership advice
- vague planning content
- motivational business coaching
- startup hustle language
- product-management filler
- padded "strategy matters" prose
- inspirational phrasing
- louder competitive tone without sharper diagnosis
- overly academic abstraction that loses the real strategic choice

Metadata and package hygiene:
- title must normalize to `Good Strategy / Bad Strategy`
- author must normalize to `Richard Rumelt`
- no decorative quotes or hyphen-stitched title / author corruption in metadata
- chapterRange must normalize to `1-17`
- review wrappers and release packages must carry the same clean book object
- strong chapter body plus dirty wrapper is a failed package, not a pass

Support-layer rules:
- the support shell must be as strong as the chapter body
- review cards must use the rich canonical shape with `cardId`, `difficulty`, `front`, and `back`
- review card fronts and backs must sound chapter-authored, not like generic study prompts
- implementation plans must use the full canonical structure:
  - `coreSkill`
  - `ifThenPlans`
  - `twentyFourHourChallenge`
  - `weeklyPractice`
- implementation surfaces must reinforce the chapter's actual mechanism, not generic self-improvement advice
- examples, quiz, review cards, implementation plan, and wrapper metadata must feel like one coherent artifact

Variant control:
- easy stays readable but still strategic
- medium adds mechanism, friction, and consequence
- hard adds boundary, transfer pressure, or strategic limit without softening into commentary
- competitive should get narrower and sharper, not louder or more motivational

Boundary control:
- every chapter must preserve what the chapter is not saying
- leverage must not become generic focus talk
- proximate objectives must not become vague milestone language
- growth must not become expansion worship
- dynamics must not become trend watching
- design must not become generic planning advice
- inertia and entropy must not become generic change-management cliché

Quick rejection tests:
- if the line could fit in generic management content, reject it
- if the line sounds like startup coaching, reject it
- if the chapter body sounds strong but the shell looks thinner, reject the package
- if a review card could belong to almost any strategy book, rewrite it
- if the implementation plan sounds like habit coaching instead of strategic reinforcement, rewrite it
