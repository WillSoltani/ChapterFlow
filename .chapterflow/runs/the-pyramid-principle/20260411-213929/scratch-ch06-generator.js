const fs = require('fs');
const path = require('path');

const runRoot = path.resolve('.chapterflow/runs/the-pyramid-principle/20260411-213929');

const canonicalDraft = `Chapter 6 turns from hidden logic to visible control on the page. A writer may have built a sound pyramid and may know exactly which ideas belong above or below others, but the reader still has to see that structure. When the page does not reveal the hierarchy, the reader ends up reconstructing it in silence. That extra repair work weakens clarity even when the underlying reasoning is solid.

The frozen heading map keeps the chapter practical. The issue is not generic formatting taste. It is how to highlight the structure. The recovered headings point to three visible devices: underlined points, decimal numbering, and indented display. Each one helps the reader see how the parts relate if it is used to expose structure rather than to decorate the page.

Underlined points matter because they can mark the main statements the reader should retain. If every sentence is treated the same way, the eye has to guess which claims carry the weight. A restrained emphasis signal can tell the reader which ideas function as the major points in the hierarchy. Used carelessly, the same device becomes noise and makes the page look excited rather than clear.

Decimal numbering helps when the writer needs to show levels and order explicitly. A top point can branch into subpoints, and those subpoints can branch again. Numbering gives the reader a map of that descent. It also makes it easier to refer back to a specific point later in the document. The value is not formality by itself. The value is visible relationship.

Indented display performs a similar job through spacing rather than labels. Parent ideas stay closer to the margin, and child ideas move inward beneath them. That visual drop tells the reader what depends on what. A clean indentation pattern can often reveal the structure faster than a dense paragraph can explain it. It turns hidden grouping into something the eye can catch early.

The practical warning is that visible signals do not rescue bad thinking. Numbering a weak list does not make it a structure. Underlining a vague sentence does not make it a key point. Indenting random bullets does not create hierarchy. The display methods are valuable only when they reveal a structure that already exists and when they do so honestly.

For that reason, the chapter belongs after the distinction between deduction and induction. Once the writer knows what movement the section is using, the next task is to show that movement on the page. A deductive chain may need explicit sequence. An inductive group may need a display that makes sibling status obvious. Visibility serves the reasoning pattern instead of replacing it.

Examples make the gain easy to see. A manager can improve a recommendation memo by making the main claim and its supporting reasons visibly distinct instead of burying all of them in uniform paragraphs. A student can make an argument easier to follow by indenting evidence under the interpretation it supports. A personal planning note can become less chaotic when the main decisions are separated clearly from the details beneath them.

The payoff is reader control. When the structure is highlighted well, the reader stops guessing where the main line is, where the support begins, and how the lower points connect. The page starts carrying part of the explanatory burden. That does not replace good logic, but it prevents good logic from hiding. Once the structure is visible, the next question is whether the grouping and order themselves deserve to stay as they are.`;

const editedDraft = `Chapter 6 shifts from correct structure to visible structure. A writer can build a sound pyramid and still make the reader work too hard if the page does not show where the main points sit, how the support nests, or what should be read as sequence rather than detail. When the hierarchy stays invisible, the reader has to reconstruct it silently. Even solid reasoning feels heavier when that repair job has been left to the audience.

The frozen heading map keeps the topic narrower than generic formatting advice. The issue is how to highlight the structure. The recovered headings name three devices: underlined points, decimal numbering, and indented display. They matter because they can reveal hierarchy on sight. They fail when they are treated as decoration instead of as structural guidance.

Underlined points can help the reader spot the main claims quickly. In a dense memo or study note, not every sentence deserves equal visual weight. A restrained emphasis cue can mark the statements that carry the argument so the eye does not have to hunt for them. But emphasis only works when it is selective. If everything is highlighted, nothing has been clarified.

Decimal numbering is useful when the hierarchy has to be explicit. A top point can split into major supports, and each support can split again into details or actions. Numbering shows those levels and lets the reader track where each point belongs. It also makes cross-reference easier when the writer needs to return to a specific branch later. The gain is not stiffness. The gain is visible relationship.

Indented display can reveal the same hierarchy through spacing. Parent ideas remain farther left. Child ideas move inward beneath them. That pattern gives the reader an immediate sense of dependence and grouping before any sentence explains it. A clean indented display often shows structure faster than a block paragraph can.

The danger is easy to miss. Visible cues do not create logic by themselves. Numbering a loose list does not make it coherent. Underlining a vague sentence does not turn it into a real top line. Indenting random bullets does not produce a hierarchy. The display has value only when it exposes a structure that already exists and does so honestly.

That connection is why Chapter 6 follows the separation between deduction and induction. Once the writer knows what kind of movement the section is using, the page should help the reader see that movement. A deductive chain may need explicit sequence markers. An inductive group may need a display that makes sibling status unmistakable. Presentation serves reasoning. It does not substitute for it.

The practical gain shows up in ordinary documents. A manager can turn a crowded recommendation memo into a readable structure by signaling the governing claim and setting its support beneath it. A student can make an essay easier to scan by showing which pieces of evidence belong under which interpretation. A personal planning page can stop feeling chaotic when the main decisions are separated clearly from the supporting tasks and notes.

Highlighting the structure gives the page a share of the explanatory burden. The reader spends less energy guessing what matters, where a branch begins, or how lower points relate to the claim above them. Good logic stops hiding in uniform prose. Once the structure is visible, the next discipline is to test whether the grouping order itself is right.`;

const criticReport = `# Chapter 6 Critic Report

- hook quality: 2/2. The opening frames reader repair work as the central cost of hidden structure.
- paragraph-job distinctness: 2/2. The draft separates visibility, emphasis, numbering, indentation, limits, and practical transfer cleanly.
- anchor use: 2/2. Frozen chapter headings remain load-bearing across the explanation.
- chapter specificity: 2/2. The prose stays tied to structure visibility rather than drifting into general design advice.
- easy-mode convertibility: 1/2. The core idea compresses well, but underlining versus indentation must stay concrete during conversion.
- meta-distance: 2/2. The draft teaches the page-level problem directly instead of talking about writing in the abstract.
- hard-edge preservation: 2/2. Cosmetic formatting without real hierarchy remains an explicit failure mode.
- conceptual repetition risk: 1/2. Reader-guidance language can echo earlier clarity chapters if the validator does not keep the visibility angle sharp.

Score: 12/12

Weakest paragraph:
Paragraph 8. The examples are useful but must keep hierarchy visibility at the center rather than sliding toward generic productivity advice.

Strongest sentence:
"Good logic stops hiding in uniform prose."

Contamination phrase or source-splice suspicion:
No contamination phrases detected. No source-splice suspicion.

Decision:
Approved for conversion path. Keep the display methods tied to reader guidance and structural honesty.

Patch guidance:
- preserve the distinction between revealing structure and decorating the page
- keep underlining, numbering, and indentation concrete across all variant surfaces
- preserve the bridge to questioning order in the next chapter
`;

const quiz = {
  passingScorePercent: 80,
  questions: [
    {
      questionId: 'q01',
      prompt: 'Why does a reader struggle when the page does not show the hierarchy clearly?',
      choices: [
        'Because the reader has to reconstruct the structure silently',
        'Because every document needs more color',
        'Because structure only matters in presentations'
      ],
      correctIndex: 2,
      explanation: {
        gentle: 'Hidden hierarchy forces the reader to do repair work alone.',
        direct: 'The page stops helping, so the reader must infer the structure.',
        competitive: 'If the page hides the ladder, the reader has to build it.'
      },
      bloomsLevel: 'remember-understand',
      depthLevel: 'easy'
    },
    {
      questionId: 'q02',
      prompt: 'What is the main job of underlined points in this chapter?',
      choices: [
        'To make every sentence look more important',
        'To mark major points the reader should notice quickly',
        'To replace the need for supporting detail'
      ],
      correctIndex: 1,
      explanation: {
        gentle: 'Selective emphasis helps the reader spot the main claims.',
        direct: 'Underlining works when it marks major points rather than decorating everything.',
        competitive: 'Use emphasis to signal the load-bearing lines, not to shout at the page.'
      },
      bloomsLevel: 'remember-understand',
      depthLevel: 'easy'
    },
    {
      questionId: 'q03',
      prompt: 'What does decimal numbering help reveal?',
      choices: [
        'The weather around the meeting',
        'The emotional tone of each paragraph',
        'The levels and order of the hierarchy'
      ],
      correctIndex: 2,
      explanation: {
        gentle: 'Numbering can show how points branch into subpoints.',
        direct: 'It makes levels and sequence visible on the page.',
        competitive: 'Decimal numbering turns hidden rank into visible order.'
      },
      bloomsLevel: 'remember-understand',
      depthLevel: 'easy'
    },
    {
      questionId: 'q04',
      prompt: 'What is the strongest value of indented display?',
      choices: [
        'It shows parent and child relationships through spacing',
        'It proves the writer is formal',
        'It removes the need for any summary point'
      ],
      correctIndex: 0,
      explanation: {
        gentle: 'Indentation shows what sits under what.',
        direct: 'Spacing can reveal dependence and grouping before the reader parses every sentence.',
        competitive: 'The eye catches the hierarchy before the mind has to rebuild it.'
      },
      bloomsLevel: 'apply-analyze',
      depthLevel: 'medium'
    },
    {
      questionId: 'q05',
      prompt: 'A memo numbers a list of unrelated thoughts. What is the likely problem?',
      choices: [
        'The numbering reveals a strong hierarchy automatically',
        'Visible cues are being used without a real structure underneath',
        'The writer should remove all formatting from the memo'
      ],
      correctIndex: 1,
      explanation: {
        gentle: 'Numbering does not create structure by itself.',
        direct: 'A display method helps only when it exposes a hierarchy that already exists.',
        competitive: 'A numbered mess is still a mess.'
      },
      bloomsLevel: 'apply-analyze',
      depthLevel: 'medium'
    },
    {
      questionId: 'q06',
      prompt: 'Why does Chapter 6 follow the distinction between deduction and induction?',
      choices: [
        'Because the writer first needs to know what movement should be visible on the page',
        'Because visible structure removes the need to choose a reasoning pattern',
        'Because formatting rules are more important than logic'
      ],
      correctIndex: 0,
      explanation: {
        gentle: 'The page should reveal the movement only after the movement is understood.',
        direct: 'Visibility serves the reasoning pattern instead of replacing it.',
        competitive: 'Pick the engine first, then show it honestly.'
      },
      bloomsLevel: 'apply-analyze',
      depthLevel: 'medium'
    },
    {
      questionId: 'q07',
      prompt: 'A student indents evidence beneath the interpretation it supports. Which chapter principle is being applied well?',
      choices: [
        'Formatting should stay neutral so the reader can guess the structure',
        'Visible display should help the reader see hierarchy directly',
        'Evidence should always be underlined instead of grouped'
      ],
      correctIndex: 1,
      explanation: {
        gentle: 'The indentation lets the reader see what supports what.',
        direct: 'The display is carrying part of the explanatory burden.',
        competitive: 'The page is finally doing its share of the work.'
      },
      bloomsLevel: 'apply-analyze',
      depthLevel: 'medium'
    },
    {
      questionId: 'q08',
      prompt: 'What is the chapter’s central warning about visible formatting devices?',
      choices: [
        'They matter only in school essays',
        'They should be used on every line for consistency',
        'They fail when they decorate the page instead of revealing real structure'
      ],
      correctIndex: 2,
      explanation: {
        gentle: 'Display methods help only when they reveal actual hierarchy.',
        direct: 'Cosmetic formatting cannot rescue weak or hidden structure.',
        competitive: 'Signals without structure are theater.'
      },
      bloomsLevel: 'evaluate',
      depthLevel: 'hard'
    },
    {
      questionId: 'q09',
      prompt: 'What practical gain comes from highlighting structure well?',
      choices: [
        'The reader spends less effort guessing how the points relate',
        'The writer never needs summaries again',
        'Every document becomes shorter automatically'
      ],
      correctIndex: 0,
      explanation: {
        gentle: 'The reader can follow the hierarchy more easily.',
        direct: 'Visible structure reduces repair work and clarifies relationships.',
        competitive: 'The reader stops burning attention on hidden wiring.'
      },
      bloomsLevel: 'evaluate',
      depthLevel: 'hard'
    },
    {
      questionId: 'q10',
      prompt: 'Once the structure is visible on the page, what question comes next in the sequence of chapters?',
      choices: [
        'Whether all numbering should be removed',
        'Whether underlining can replace introductions',
        'Whether the grouping and order themselves are actually right'
      ],
      correctIndex: 0,
      explanation: {
        gentle: 'The next issue is testing the grouping order itself.',
        direct: 'Visibility comes before questioning whether the arrangement deserves to stay.',
        competitive: 'After the structure shows itself, it has to survive inspection.'
      },
      bloomsLevel: 'evaluate-create',
      depthLevel: 'hard'
    }
  ]
};

const chapter = {
  book: {
    bookId: 'the-pyramid-principle',
    title: 'The Pyramid Principle',
    author: 'Barbara Minto',
    variantFamily: 'EMH'
  },
  chapterId: 'ch06-how-to-highlight-the-structure',
  number: 6,
  title: 'How to highlight the structure',
  readingTimeMinutes: 9,
  contentVariants: {
    easy: {
      chapterBreakdown: {
        gentle: `Chapter 6 explains that good structure is not enough if the page does not show it. A reader should not have to guess which ideas are the main points and which ones sit underneath them. The focus stays on visible signals that reveal hierarchy. Underlined points can mark the statements that carry the argument. Decimal numbering can show levels and sequence when the structure has several layers. Indented display can show what depends on what by moving child points inward. These devices help only when they expose a real structure that already exists. They do not create logic on their own. Used well, they reduce reader effort because the eye can catch the hierarchy early. Used badly, they decorate the page while leaving the real relationships hidden. The writer's job is to make the structure visible enough that the reader can follow it without silent repair work.`,
        direct: `Chapter 6 turns invisible logic into visible control. A sound hierarchy can still feel hard to follow if the page hides it inside uniform text. Readers should be able to see where the main line sits, where support begins, and how lower points connect. Underlined points help mark major claims. Decimal numbering helps show levels and order across a branching structure. Indented display helps reveal parent and child relationships through spacing. None of those devices are valuable as decoration. They matter only when they expose relationships that already exist in the thinking. A numbered mess is still a mess. A highlighted vague sentence is still vague. The gain comes when the page starts carrying some of the explanatory burden. Then the reader spends less effort rebuilding the structure and more effort following it. Chapter 6 is about making the hierarchy visible enough that good logic stops hiding in plain prose.`,
        competitive: `Chapter 6 is about page control. A writer can build a solid structure and still make the reader do extra labor if the hierarchy stays hidden. The page should show rank, sequence, and dependence without forcing the reader to reverse-engineer them. Underlined points can mark the lines that actually carry the argument. Decimal numbering can expose levels and order. Indented display can show which points are parents and which ones are children. Those devices are useful only when they reveal real structure. They are worthless as page cosmetics. Numbering random thoughts does not create discipline. Underlining everything does not create emphasis. Indenting a loose list does not create hierarchy. The win comes when the display tells the truth about the logic underneath it. Then the reader stops guessing where the main line is and starts moving through the structure with less drag and less doubt.`
      },
      keyTakeaways: [
        {
          point: {
            gentle: 'Structure has to be visible on the page, not just correct in the writer’s head.',
            direct: 'Hidden hierarchy makes the reader reconstruct the argument silently.',
            competitive: 'Good logic still loses when the page hides it.'
          }
        },
        {
          point: {
            gentle: 'Underlining, numbering, and indentation can reveal hierarchy.',
            direct: 'Visible signals help the reader see rank, sequence, and dependence.',
            competitive: 'Use page signals to show the wiring.'
          }
        },
        {
          point: {
            gentle: 'Formatting helps only when it exposes real structure.',
            direct: 'Display devices are structural aids, not decoration.',
            competitive: 'Signals without structure are theater.'
          }
        }
      ],
      oneMinuteRecap: {
        gentle: 'Make the hierarchy visible so the reader can see main points and support without guessing.',
        direct: 'Chapter 6 turns structure into something the page can show clearly.',
        competitive: 'If the logic is real, make the page prove it.'
      }
    },
    medium: {
      chapterBreakdown: {
        gentle: `Chapter 6 addresses a problem that appears after the writer has already done the hard thinking. The structure may be real. The support may sit in the right places. Yet the page can still make the reader work too hard if it does not reveal the hierarchy clearly. The reader should not have to infer where the main points sit or how the lower points belong beneath them.\n\nThe frozen heading map keeps the remedy concrete. The focus is highlighting the structure, and the recovered headings name three ways to do that: underlined points, decimal numbering, and indented display. These are not decorative tricks. They are ways to let the page carry some of the burden of explanation.\n\nUnderlined points can help the reader identify the statements that deserve the most attention. In a dense memo or study note, a selective emphasis signal tells the eye which lines are doing the main work. The same device becomes useless when it is applied everywhere, because the reader loses the contrast that made it helpful.\n\nDecimal numbering helps when the writer needs to show levels and order explicitly. One major point can branch into several supports, and each support can branch again into details, actions, or evidence. Numbering makes that descent visible and makes cross-reference easier later in the document. Its value lies in visible relationship, not in formal appearance.\n\nIndented display reveals hierarchy through spacing. Parent ideas stay farther left, while child ideas move inward beneath them. That visual shift can show grouping and dependence faster than a dense paragraph can explain them. It helps the eye recognize structure before the reader has to reconstruct it sentence by sentence.\n\nThe danger is to confuse visible signals with real thinking. Underlining a vague line does not make it a top point. Numbering an ungrouped list does not make it coherent. Indenting random bullets does not produce hierarchy. These devices help only when they expose a structure that already exists and do so honestly.\n\nFor that reason, Chapter 6 follows the separation between deduction and induction. Once the writer knows what movement the section is using, the next task is to let the page make that movement visible. A chain may need sequence markers. A grouped set may need a display that shows sibling status cleanly. The result is less reader repair work, clearer rank, and more direct control of the argument.`,
        direct: `Chapter 6 moves from correct structure to visible structure. A writer can have a sound hierarchy and still make the page harder to follow than necessary if the display hides what belongs where. Readers should be able to see the main line, the supporting branches, and the level shifts without rebuilding them alone.\n\nThe frozen chapter map keeps the discussion practical. The issue is how to highlight the structure. The recovered headings point to underlined points, decimal numbering, and indented display. Each one is a way to reveal hierarchy on sight when the underlying thinking is already in order.\n\nUnderlined points help mark the claims that carry the argument. Selective emphasis tells the reader which lines deserve immediate attention. Used everywhere, it collapses into noise. Used sparingly, it keeps the eye from wandering across a field of equal-looking sentences.\n\nDecimal numbering is useful when levels and sequence need explicit markers. A top point can split into supports, and those supports can split again into details or actions. Numbering shows where each point belongs and makes later reference cleaner. Its value is not stiffness. Its value is visible rank and relationship.\n\nIndented display shows hierarchy through spacing instead of labels. Parent points stay left. Child points move inward. That visual drop makes dependence and grouping easier to detect quickly. Often the eye can understand the structure before the reader has parsed every sentence.\n\nThe risk is to mistake display for logic. Numbering does not create coherence. Underlining does not turn a vague sentence into a real key line. Indenting a loose list does not create a tree. The visible devices help only when they reveal a structure that already exists and match it honestly.\n\nChapter 6 belongs after deduction and induction for a reason. Once the writer knows what kind of movement the section is using, the page should help show it. A deductive chain may need explicit sequence cues. An inductive group may need display choices that make sibling status obvious. Good highlighting reduces reader repair work because the page starts carrying its share of the explanation. That shift gives the reader faster orientation and cleaner trust.`,
        competitive: `Chapter 6 is about making the page tell the truth about the logic. A strong structure can still feel weak if the hierarchy is buried in uniform prose. When readers cannot see rank, sequence, or dependence quickly, they spend attention reverse-engineering the argument instead of following it.\n\nThe recovered heading map keeps the solution narrow: underlined points, decimal numbering, indented display. Those are not cosmetic flourishes. They are ways to expose the structure so the eye can catch it early.\n\nUnderlined points can mark the lines that actually carry the argument. That works only when the emphasis is selective. If every sentence gets treated like a headline, the contrast vanishes and the page starts shouting instead of guiding.\n\nDecimal numbering is useful when the writer needs explicit hierarchy and order. One point branches into others. Those branches split again. Numbering lets the reader see the rank of each point and return to a branch later without getting lost. The gain is control, not ceremony.\n\nIndented display does similar work through spacing. Parents stay left. Children move inward. That visual drop reveals grouping and dependence before the reader has to puzzle them out from a block of prose. It is one of the fastest ways to show hidden wiring.\n\nThe trap is obvious once you see it. Visible cues do not create structure. A numbered mess is still a mess. A vague line stays vague after underlining. Random indentation does not produce hierarchy. Signals help only when they expose real order underneath.\n\nFor that reason, Chapter 6 follows the reasoning-pattern chapter. First decide what movement the section is using. Then make the page show that movement honestly. Sequence cues fit chains. Grouped display fits sibling support. When the page stops hiding the hierarchy, the reader stops wasting effort on repair and starts trusting the structure sooner. That visible honesty lets readers judge the argument itself instead of wasting energy on hidden rank, buried branches, and flat-looking support across the page first.`,
      },
      keyTakeaways: [
        {
          point: {
            gentle: 'Readers need visible hierarchy, not just correct hidden logic.',
            direct: 'A page that hides structure increases reader repair work.',
            competitive: 'Hidden wiring forces the reader to become your mechanic.'
          },
          moreDetails: {
            gentle: 'The page should help the reader see where the main points sit and what belongs underneath them.',
            direct: 'Visible structure lets the eye catch rank and relationship early.',
            competitive: 'If the page hides the ladder, the reader burns attention building one.'
          }
        },
        {
          point: {
            gentle: 'Underlined points can mark the main statements.',
            direct: 'Selective emphasis can signal which lines carry the argument.',
            competitive: 'Underline the load-bearing lines, not the whole room.'
          },
          moreDetails: {
            gentle: 'The cue stops helping when everything is highlighted equally.',
            direct: 'Contrast is what makes emphasis useful.',
            competitive: 'If every line is special, none of them outranks the others.'
          }
        },
        {
          point: {
            gentle: 'Decimal numbering can show levels and order.',
            direct: 'Numbering helps display branching structure and sequence.',
            competitive: 'Numbers can make rank visible fast.'
          },
          moreDetails: {
            gentle: 'It also helps the reader return to a specific branch later.',
            direct: 'The gain is visible relationship, not formal appearance.',
            competitive: 'The real win is control, not ceremony.'
          }
        },
        {
          point: {
            gentle: 'Indented display can reveal parent and child points through spacing.',
            direct: 'Indentation shows dependence and grouping without extra explanation.',
            competitive: 'Spacing can expose the hierarchy before the prose explains it.'
          },
          moreDetails: {
            gentle: 'Moving child points inward shows what sits beneath a higher idea.',
            direct: 'The eye often catches the structure before the sentence-by-sentence reading is complete.',
            competitive: 'A clean left margin can tell the truth fast.'
          }
        },
        {
          point: {
            gentle: 'Visible cues help only when they reveal real structure honestly.',
            direct: 'Formatting cannot rescue weak grouping or vague claims.',
            competitive: 'Signals without structure are expensive theater.'
          },
          moreDetails: {
            gentle: 'The writer still has to build the hierarchy before showing it.',
            direct: 'Display methods serve reasoning rather than substitute for it.',
            competitive: 'First build the skeleton. Then let the page show the bones.'
          }
        }
      ],
      activationPrompt: {
        gentle: 'Look at one live page and ask whether the main points and support are visible at a glance.',
        direct: 'Choose one document and test whether the display reveals rank, sequence, and dependence without extra explanation.',
        competitive: 'Audit one page and ask whether the reader sees the wiring or has to reverse-engineer it.'
      },
      selfCheckPrompt: {
        gentle: 'Why does a numbered or highlighted page still fail when the hierarchy underneath it is weak?',
        direct: 'What makes visible formatting useful only when it matches a real structure?',
        competitive: 'Why does page control collapse when the signals are lying?'
      },
      oneMinuteRecap: {
        retrieve: {
          gentle: 'What three display methods does Chapter 6 emphasize?',
          direct: 'Name the visible structure signals highlighted here.',
          competitive: 'Which tools make the page show the wiring?'
        },
        connect: {
          gentle: 'How do those methods reduce reader effort?',
          direct: 'Why does visible hierarchy lower repair work for the reader?',
          competitive: 'Connect the chain: visible rank, less repair, more trust.'
        },
        preview: {
          gentle: 'Once the structure is visible, what deeper question comes next?',
          direct: 'What comes after page visibility is solved?',
          competitive: 'Once the page shows the ladder, what deserves inspection next?'
        }
      }
    },
    hard: {
      chapterBreakdown: {
        gentle: `Chapter 6 addresses a mistake that often survives even after the writer has done serious structural work. The hierarchy may be sound, the support may belong in the right places, and the conclusion may be justified, yet the page can still impose unnecessary strain if it does not reveal that structure clearly. Readers should not have to reconstruct the hierarchy in silence while they are also trying to understand the argument itself.\n\nThe locked heading map keeps the focus narrow. The problem is not taste in formatting. It is how to highlight the structure so the reader can see it. The recovered headings name underlined points, decimal numbering, and indented display as concrete ways to expose hierarchy. Each one is useful only when it helps the page tell the truth about the logic underneath it.\n\nUnderlined points can mark the statements carrying the most weight. In a crowded memo, recommendation, or study guide, a selective emphasis cue helps the eye identify the lines that function as major claims. That is valuable because readers often scan before they read deeply. If the main lines are invisible at scanning speed, the document has already surrendered part of its control. At the same time, emphasis fails when it is sprayed across the page without discipline. Highlight everything and the contrast disappears.\n\nDecimal numbering helps when structure needs explicit levels and sequence. One major point can split into several supports, each of which can split again into reasons, evidence, or actions. Numbering makes the hierarchy traceable. It also makes later reference easier because the writer and reader can return to the same branch without confusion. The gain is not the appearance of formality. It is visible relationship, rank, and order.\n\nIndented display performs similar work through spacing rather than labels. Parent points remain closer to the margin, while child points move inward beneath them. That visual descent lets the eye catch dependence and grouping quickly, often before the reader has fully parsed the surrounding sentences. A good indented display therefore reduces hidden labor. The page starts carrying some of the explanation that would otherwise remain trapped in prose.\n\nThe danger is to confuse visible signals with structural quality. Underlining a vague claim does not make it a real key line. Numbering a loose list does not make the list coherent. Indenting random bullets does not create a hierarchy. Display methods do not rescue bad thinking. They only reveal good thinking when it is already there and when the display matches it honestly.\n\nChapter 6 follows the distinction between deduction and induction because the writer must know the movement before showing it. A deductive chain may need numbered sequence or strongly signaled steps. An inductive group may need a display that makes sibling status unmistakable. The display method should fit the reasoning pattern instead of flattening it.\n\nThe practical gain is large. A manager can make a recommendation memo easier to trust by showing the governing claim and setting its support visibly beneath it. A student can make evidence easier to scan by indenting it under the interpretation it supports. A personal planning page can stop feeling chaotic when the main decisions are separated from the details beneath them.\n\nOnce the hierarchy is visible, the next discipline becomes sharper. The reader can now inspect whether the grouping and order themselves deserve trust. Visibility is not the end of rigor. It is what makes deeper rigor possible.`,
        direct: `Chapter 6 handles a structural problem that appears after the argument has already been built: the page may still fail to show the hierarchy clearly enough for the reader to follow it without repair work. A writer can have the right top line, the right support, and the right reasoning pattern, yet still lose clarity if the display conceals rank, sequence, or dependence.\n\nThe frozen heading map keeps the remedy concrete. The issue is how to highlight the structure. The recovered headings point to underlined points, decimal numbering, and indented display. Those are not generic formatting preferences. They are practical devices for making the hierarchy visible.\n\nUnderlined points help when the reader needs to identify the governing statements quickly. In dense prose, selective emphasis can keep the eye from treating every line as equal. That matters because readers often scan for the main claims before they commit to full reading. But the device collapses when emphasis is used everywhere. Once everything is highlighted, nothing is distinguished.\n\nDecimal numbering is useful when the hierarchy needs explicit levels or sequence markers. One point branches into several supports, and those supports can branch again into evidence, actions, or subordinate reasons. Numbering lets the reader track where each branch sits and return to it later. Its value is visible rank and relationship, not ceremonial formality.\n\nIndented display reveals similar information through spatial position. Parent points stay left. Child points move inward. That visual shift shows grouping and dependence before the reader has reconstructed them from prose. It allows the page to carry part of the explanatory load.\n\nThe central warning is that display is not logic. Numbering does not create coherence. Underlining does not turn a vague sentence into a real key line. Indentation does not make unrelated bullets into a hierarchy. Visible signals help only when they expose a structure that already exists and when they fit that structure honestly.\n\nThat warning matters because polished formatting can conceal weakness. A document can look controlled while still forcing the reader to guess which point governs which. The page appears ordered, but the logic is still doing hidden damage. Good highlighting therefore requires structural honesty, not just neat display.\n\nChapter 6 belongs exactly where it sits in the book. After separating deduction from induction, the writer has to decide how the page will reveal that movement. A deductive chain may need explicit sequence signals. An inductive group may need a display that makes sibling status unmistakable. The surface should help the reader see the same pattern the writer intends.\n\nThe practical gain is not cosmetic. Once the hierarchy is visible, the reader spends less effort reconstructing the structure and more effort evaluating the claim. A memo, essay, or planning page becomes easier to trust because the page stops hiding the wiring. That prepares the next move: questioning whether the grouping order itself is actually right. The reader gets faster bearings and cleaner judgment from page control.`,
        competitive: `Chapter 6 is about forcing the page to stop lying by omission. A writer can build a strong hierarchy and still make the document feel weak if the structure is buried in flat prose. When rank, sequence, and dependence are invisible, the reader has to reverse-engineer the logic before judging it. That is wasted effort, and it leaks trust.\n\nThe recovered heading map keeps the solution hard-edged: underlined points, decimal numbering, indented display. Those are not style accessories. They are tools for making the page tell the truth about the structure underneath.\n\nUnderlined points can mark the lines that carry the argument. That matters because readers scan first. If the load-bearing sentences hide inside a wall of equal-looking text, the document has already surrendered control. Emphasis works only when it is selective. Highlight everything and the page loses contrast, discipline, and rank all at once.\n\nDecimal numbering is useful when the structure needs explicit levels or sequence. One point branches into others. Those branches split again. Numbering lets the reader see the rank of each point, trace movement through the hierarchy, and return to a branch later without drifting. The gain is visible command, not bureaucratic ceremony.\n\nIndented display does similar work through position. Parents hold the margin. Children move inward. That visual drop tells the truth about grouping and dependence faster than a dense paragraph can. It is one of the cleanest ways to expose hidden wiring before the reader starts doing repair work.\n\nThe trap is brutal because it looks polished. Visible cues do not create logic. A numbered mess is still a mess. A vague sentence stays vague after underlining. Random indentation still produces random structure. When the signals and the logic disagree, the page is not helping the reader. It is staging fake control.\n\nThat matters because page polish can mask structural weakness for longer than prose alone. The document can look crisp, organized, and serious while the reader is still guessing what governs what. The eye sees order. The mind feels drag. That gap is expensive because it burns attention exactly where trust should be growing.\n\nChapter 6 follows deduction and induction for a reason. First decide what movement the section is using. Then make the page show that movement honestly. Chains may need explicit sequence markers. Grouped support may need display that makes sibling rank obvious. If the surface flattens the reasoning pattern, the page is working against the logic instead of for it.\n\nThe reward is practical and immediate. A manager can make a recommendation memo easier to trust by showing the governing claim and nesting the support beneath it. A student can make evidence easier to follow by displaying what belongs under which interpretation. A personal planning page can stop feeling chaotic when the main decisions stand apart from the details and tasks below them. In every case, the page takes over work the reader should never have been doing.\n\nOnce the structure is visible, the next fight starts. The reader can now ask whether the grouping order itself deserves to survive inspection. Visibility does not replace rigor. It exposes the argument so rigor can finally hit it cleanly.`,
      },
      keyTakeaways: [
        {
          point: {
            gentle: 'A hidden hierarchy can weaken even a sound argument.',
            direct: 'The page can create drag when it conceals rank, sequence, or dependence.',
            competitive: 'Strong logic still leaks when the surface hides the wiring.'
          },
          moreDetails: {
            gentle: 'Readers should not have to rebuild the structure while reading the argument.',
            direct: 'Visible hierarchy lets the page share the burden of explanation.',
            competitive: 'If the reader has to reverse-engineer the ladder, trust already costs too much.'
          }
        },
        {
          point: {
            gentle: 'Underlined points can make major claims visible quickly.',
            direct: 'Selective emphasis helps readers locate the governing lines.',
            competitive: 'Mark the load-bearing sentences and stop there.'
          },
          moreDetails: {
            gentle: 'The cue works only when it is restrained enough to preserve contrast.',
            direct: 'Universal emphasis destroys the distinction it was supposed to create.',
            competitive: 'If everything is highlighted, the page has no rank left.'
          }
        },
        {
          point: {
            gentle: 'Decimal numbering can expose levels and order clearly.',
            direct: 'Numbering makes branching structure and sequence easier to trace.',
            competitive: 'Numbers can turn hidden rank into visible command.'
          },
          moreDetails: {
            gentle: 'It also helps the writer and reader return to a specific branch later.',
            direct: 'Its value is structural visibility rather than formal appearance.',
            competitive: 'The real win is control, not ceremony.'
          }
        },
        {
          point: {
            gentle: 'Indented display shows hierarchy through position on the page.',
            direct: 'Spacing can reveal grouping and dependence before the prose has done all the explaining.',
            competitive: 'Margin control can expose the tree fast.'
          },
          moreDetails: {
            gentle: 'Parent ideas stay left while child ideas move inward beneath them.',
            direct: 'The eye often understands the nesting before sentence-by-sentence reconstruction is complete.',
            competitive: 'Position can tell the truth before the paragraph finishes.'
          }
        },
        {
          point: {
            gentle: 'Visible signals help only when they match a real structure.',
            direct: 'Display methods cannot rescue vague claims or weak grouping.',
            competitive: 'Signals without structure are polished fraud.'
          },
          moreDetails: {
            gentle: 'The writer must build the hierarchy first and then reveal it honestly.',
            direct: 'Surface choices should fit the reasoning pattern rather than flatten it.',
            competitive: 'Build the skeleton first. Then let the page expose the bones.'
          }
        }
      ],
      activationPrompt: {
        gentle: 'Take one real page and mark whether the top line, support levels, and child points are visible without explanation.',
        direct: 'Audit one document for whether the display reveals hierarchy before the reader has to infer it.',
        competitive: 'Put one page on trial and ask whether the surface shows the wiring or stages fake control.'
      },
      selfCheckPrompts: [
        {
          gentle: 'Why can a tidy, well-formatted page still make the reader work too hard?',
          direct: 'What hidden labor remains when display looks orderly but hierarchy is still unclear?',
          competitive: 'How does polished formatting still leak trust?'
        },
        {
          gentle: 'Why do numbering, underlining, and indentation fail when the underlying structure is weak?',
          direct: 'What makes visible signals useful only when they expose real hierarchy honestly?',
          competitive: 'Why does surface control collapse when the signals are lying?'
        }
      ],
      predictionPrompt: {
        gentle: 'Once the hierarchy is visible, what deeper structural question needs testing next?',
        direct: 'If the page now reveals the structure, what problem follows?',
        competitive: 'Once the wiring is visible, what deserves inspection next?'
      },
      oneMinuteRecap: {
        retrieve: {
          gentle: 'What three display methods does Chapter 6 recover from the frozen heading map?',
          direct: 'Name the visible hierarchy tools emphasized here.',
          competitive: 'Which devices make the page show rank?'
        },
        connect: {
          gentle: 'How does visible structure reduce reader strain?',
          direct: 'Why does page-level hierarchy lower repair work and increase trust?',
          competitive: 'Connect the chain: visible wiring, less repair, cleaner trust.'
        },
        preview: {
          gentle: 'After the structure becomes visible, what kind of order question comes next?',
          direct: 'What chapter-level inspection follows once visibility is solved?',
          competitive: 'If the page shows the structure, what does the next chapter attack?'
        }
      }
    }
  },
  examples: [
    {
      exampleId: 'ch06-ex01-recommendation-memo',
      title: 'Lena Marks the Governing Claim in a Recommendation Memo',
      category: 'work',
      format: 'decision_point',
      endingType: 'relief',
      scenario: {
        gentle: 'Lena has a sound recommendation, but every paragraph in her memo looks the same on the page.',
        direct: 'Her reader has to guess which sentence is the main claim and which ones are support.',
        competitive: 'Lena buried the top line in a flat wall of text.'
      },
      whatToDo: {
        gentle: 'Mark the governing claim clearly and place the supporting reasons beneath it in a visible hierarchy.',
        direct: 'Use display cues so the top line and its branches stop blending together.',
        competitive: 'Make the page show who outranks whom.'
      },
      whyItMatters: {
        gentle: 'The memo becomes easier to follow because the reader no longer has to infer the structure alone.',
        direct: 'Visible hierarchy lets the reader see the claim-support relationship quickly.',
        competitive: 'The page starts carrying its share of the argument.'
      }
    },
    {
      exampleId: 'ch06-ex02-training-outline',
      title: 'Omar Uses Decimal Numbering for a Multi-Step Rollout',
      category: 'work',
      format: 'comparison',
      endingType: 'confidence',
      scenario: {
        gentle: 'Omar is writing a rollout outline with several levels of actions and sub-actions.',
        direct: 'Without visible levels, the plan reads like one long undifferentiated list.',
        competitive: 'The rollout has branches, but the page hides the tree.'
      },
      whatToDo: {
        gentle: 'Use decimal numbering to show the levels and order of the plan.',
        direct: 'Number the branches so the reader can track where each action belongs.',
        competitive: 'Give the hierarchy numbers so rank stops pretending to be flat.'
      },
      whyItMatters: {
        gentle: 'The rollout becomes easier to scan and reference later.',
        direct: 'Visible numbering reveals sequence and structure at the same time.',
        competitive: 'Control replaces drift once the branches are labeled honestly.'
      }
    },
    {
      exampleId: 'ch06-ex03-seminar-argument',
      title: 'Priya Indents Evidence Under Her Interpretation',
      category: 'school',
      format: 'rewrite_choice',
      endingType: 'clarity',
      scenario: {
        gentle: 'Priya has one interpretation and several supporting pieces of evidence, but they blend together in paragraph form.',
        direct: 'Her professor can see the content, yet the hierarchy is hard to spot quickly.',
        competitive: 'Priya knows the structure, but the page refuses to admit it.'
      },
      whatToDo: {
        gentle: 'Display the interpretation as the parent point and move each supporting item beneath it.',
        direct: 'Indent the evidence so the support relationship becomes visible at a glance.',
        competitive: 'Stop making the reader excavate the support tree.'
      },
      whyItMatters: {
        gentle: 'The argument becomes easier to scan without changing the underlying reasoning.',
        direct: 'Visible nesting helps the reader see what belongs under the interpretation.',
        competitive: 'The hierarchy stops hiding in the prose.'
      }
    },
    {
      exampleId: 'ch06-ex04-study-guide',
      title: 'Mateo Stops Highlighting Every Line in His Study Notes',
      category: 'school',
      format: 'diagnostic_snapshot',
      endingType: 'insight',
      scenario: {
        gentle: 'Mateo underlines almost every sentence in his study guide because he does not want to miss anything.',
        direct: 'The result is a page with no visible rank among the ideas.',
        competitive: 'Mateo turned emphasis into static.'
      },
      whatToDo: {
        gentle: 'Underline only the governing points and let the supporting details stay unmarked.',
        direct: 'Use emphasis selectively so the major lines stand out again.',
        competitive: 'Restore rank by stopping the blanket highlight attack.'
      },
      whyItMatters: {
        gentle: 'The important lines become easier to find during review.',
        direct: 'Selective emphasis gives contrast back to the page.',
        competitive: 'The page regains signal because the noise is gone.'
      }
    },
    {
      exampleId: 'ch06-ex05-family-trip-plan',
      title: 'Nora Separates Decisions From Details in a Trip Plan',
      category: 'personal',
      format: 'planning_note',
      endingType: 'relief',
      scenario: {
        gentle: 'Nora keeps all trip choices, reminders, and packing details in one running note.',
        direct: 'The page contains useful information, but the major decisions disappear inside the clutter.',
        competitive: 'Her plan has a hierarchy, but the note flattens it into chaos.'
      },
      whatToDo: {
        gentle: 'Show the main decisions first and place the smaller tasks and reminders underneath them.',
        direct: 'Use visible levels so choices, sub-tasks, and notes stop competing for equal attention.',
        competitive: 'Make the note show rank before the trip starts taxing everyone.'
      },
      whyItMatters: {
        gentle: 'The plan feels calmer because the reader can see what matters most first.',
        direct: 'Visible hierarchy separates governing decisions from supporting detail.',
        competitive: 'The page stops acting like every detail outranks the trip itself.'
      }
    },
    {
      exampleId: 'ch06-ex06-home-repair-list',
      title: 'Derek Uses Indentation to Show What Belongs to Each Repair',
      category: 'personal',
      format: 'coaching_moment',
      endingType: 'confidence',
      scenario: {
        gentle: 'Derek has several home repairs, each with its own supplies and next steps, but his list is completely flat.',
        direct: 'He keeps rereading the note because he cannot see which detail belongs to which repair.',
        competitive: 'Derek built a pile, not a hierarchy.'
      },
      whatToDo: {
        gentle: 'List each repair as a parent point and indent the supplies and actions underneath it.',
        direct: 'Use indentation so each branch of the plan becomes visible immediately.',
        competitive: 'Turn the pile into a tree the eye can actually follow.'
      },
      whyItMatters: {
        gentle: 'The plan becomes easier to use because the branches stop overlapping in his head.',
        direct: 'Visible nesting reduces confusion about what supports each repair item.',
        competitive: 'Once the branches are visible, the plan stops wasting attention.'
      }
    }
  ],
  quiz,
  implementationPlan: {
    coreSkill: {
      gentle: 'The core skill is making the hierarchy visible enough that the reader can see main points and support quickly.',
      direct: 'Chapter 6 trains the writer to use display choices that reveal real structure on the page.',
      competitive: 'The skill is making the page tell the truth about the wiring.'
    },
    ifThenPlans: [
      {
        context: 'work',
        plan: {
          gentle: 'If your memo has one main claim with branches under it, then make the levels visible instead of leaving them buried in uniform paragraphs.',
          direct: 'If the reader must keep asking what outranks what, add visible hierarchy to the document.',
          competitive: 'If the page is hiding rank, force it to show the chain of command.'
        }
      },
      {
        context: 'school',
        plan: {
          gentle: 'If your evidence supports one interpretation, then display the interpretation as the parent point and place the evidence beneath it.',
          direct: 'If support relationships are hard to scan, use visible nesting or numbering to reveal them.',
          competitive: 'If the argument has a tree, stop submitting a wall.'
        }
      },
      {
        context: 'personal',
        plan: {
          gentle: 'If your notes mix decisions with details, then separate the top items from the smaller tasks underneath them.',
          direct: 'If everything on the page looks equal, create visible levels before using the note again.',
          competitive: 'If the page treats every detail like a boss, restore rank.'
        }
      }
    ],
    twentyFourHourChallenge: {
      gentle: 'Within the next day, take one page of writing and mark whether the main points are visible at a glance.',
      direct: 'In the next 24 hours, audit one document for visible hierarchy instead of hidden structure.',
      competitive: 'Before tomorrow ends, force one page to show its wiring honestly.'
    },
    weeklyPractice: {
      gentle: 'Once this week, rewrite one flat page so the reader can see the levels clearly without extra explanation.',
      direct: 'Run one weekly visibility drill: rebuild a document display so the hierarchy shows itself on sight.',
      competitive: 'This week, turn one polished wall into a readable structure.'
    }
  },
  reviewCards: [
    {
      cardId: 'ch06-rc01',
      difficulty: 'easy',
      front: {
        gentle: 'Why is hidden structure a problem?',
        direct: 'What happens when the page hides the hierarchy?',
        competitive: 'Why does flat prose leak trust?'
      },
      back: {
        gentle: 'The reader has to reconstruct the structure alone.',
        direct: 'Hidden hierarchy creates repair work for the reader.',
        competitive: 'The reader starts reverse-engineering the wiring.'
      }
    },
    {
      cardId: 'ch06-rc02',
      difficulty: 'easy',
      front: {
        gentle: 'What three display methods does Chapter 6 highlight?',
        direct: 'Which page signals are central here?',
        competitive: 'What tools make the page show rank?'
      },
      back: {
        gentle: 'Underlined points, decimal numbering, and indented display.',
        direct: 'Chapter 6 focuses on emphasis, numbering, and indentation as structure signals.',
        competitive: 'Underline, number, indent.'
      }
    },
    {
      cardId: 'ch06-rc03',
      difficulty: 'medium',
      front: {
        gentle: 'When does underlining stop helping?',
        direct: 'Why does blanket emphasis fail?',
        competitive: 'How do you kill rank with a marker?'
      },
      back: {
        gentle: 'It fails when everything is highlighted equally.',
        direct: 'Underlining needs contrast to signal what matters most.',
        competitive: 'If every line shouts, nothing outranks anything.'
      }
    },
    {
      cardId: 'ch06-rc04',
      difficulty: 'medium',
      front: {
        gentle: 'What does indentation reveal?',
        direct: 'How does indented display help the reader?',
        competitive: 'What truth does the left margin tell?'
      },
      back: {
        gentle: 'It shows which points sit beneath other points.',
        direct: 'Indentation reveals grouping and dependence through spacing.',
        competitive: 'It shows who is parent and who is child.'
      }
    },
    {
      cardId: 'ch06-rc05',
      difficulty: 'hard',
      front: {
        gentle: 'Why can neat formatting still fail structurally?',
        direct: 'What is the chapter’s hardest warning about display?',
        competitive: 'When does page polish become fake control?'
      },
      back: {
        gentle: 'Visible cues fail when they decorate the page without revealing real hierarchy.',
        direct: 'Display methods cannot rescue weak structure or vague claims.',
        competitive: 'Signals without structure are polished fraud.'
      }
    }
  ],
  keyTakeawayCard: {
    gentle: 'Chapter 6 says good logic must be visible on the page: underlining, numbering, and indentation help only when they reveal the hierarchy honestly.',
    direct: 'The core move is making rank, sequence, and dependence visible so the reader stops reconstructing the structure alone.',
    competitive: 'Chapter 6 forces one rule: if the wiring is real, make the page show it.'
  }
};

function write(rel, content) {
  const file = path.join(runRoot, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

write('drafts/canonical/ch06.md', canonicalDraft + '\n');
write('drafts/edited/ch06.md', editedDraft + '\n');
write('reports/ch06.critic.md', criticReport);
write('structured/ch06.chapter.json', JSON.stringify(chapter, null, 2) + '\n');
write('quizzes/ch06.quiz.json', JSON.stringify(quiz, null, 2) + '\n');
