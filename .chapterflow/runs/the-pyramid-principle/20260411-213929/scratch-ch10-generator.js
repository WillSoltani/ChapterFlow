const fs = require('fs');
const path = require('path');

const runRoot = path.resolve('.chapterflow/runs/the-pyramid-principle/20260411-213929');

const canonicalDraft = `Chapter 10 assumes that the structure has already earned its logic. The remaining problem is that a sound structure can still arrive on the page in words that feel clumsy, abstract, or harder to absorb than they need to be. The chapter therefore turns to readable expression without relaxing any of the structural discipline built earlier.

The first step is to create the image. Before the writer chooses sentences, the writer needs to see the relationship clearly. What is moving, changing, separating, or connecting in this part of the structure? If that image is weak, the wording will tend to become generic because the writer is translating confusion into prose.

Once the image is clear, the next step is to copy the image in words. This does not mean decorating the page. It means choosing language that preserves the structural picture instead of blurring it. If the relationship is contrast, the wording should let the contrast appear. If the relationship is sequence, the wording should let the movement unfold. If the relationship is cause and result, the sentence should not flatten that difference into a vague cluster of nouns.

Readable words matter because readers do not absorb an outline the way writers do. The writer may already know the structure and may therefore tolerate wording that only hints at it. The reader does not have that privilege. The words have to carry the structure across. Readability is therefore a transmission problem, not a cosmetic one.

This also means that readable wording is not a substitute for structure. The writer cannot rescue a weak grouping or a vague summary line by making the sentences smoother. Good wording helps the reader see earned structure more quickly. It cannot invent the structure after the fact.

Examples make the point practical. A manager may write broad, padded lines that hide who is acting on what. A student may preserve the logic of a thesis poorly by translating it into abstract language that feels detached from the evidence. A household plan may use soft phrases that blur the actual change being proposed. In each case the cure is the same: see the image first, then copy it faithfully into words.

The gain is a page that reads as clearly as the structure underneath it deserves. Once the writer can see the pattern and reproduce that pattern in language, the reader no longer has to reconstruct the shape silently. Chapter 10 closes the main line of the book by showing how readable words should serve a structure that has already been earned.`;

const editedDraft = `Chapter 10 turns from structural correctness to readable expression. The hierarchy may already be sound. The grouped points may already be honest. The summary line may already fit. Yet the page can still read in a way that is slower, vaguer, or more abstract than the structure requires. The problem now is not whether the structure is right. The problem is whether the words let the reader receive that structure easily.

The first move is to create the image. Before writing sentences, the writer needs a clear mental picture of the relationships involved. What is changing? What is being contrasted? What is moving in sequence? What is producing what result? If the writer cannot see the pattern clearly, the language will usually become generic because it is trying to translate an unclear image.

The next move is to copy that image in words. Readable phrasing does not mean adding ornament. It means choosing wording that preserves the structural picture. If the relationship is sequence, the sentence should carry sequence. If it is contrast, the sentence should let the contrast appear cleanly. If it is cause and result, the wording should not blur those jobs into one foggy statement.

This matters because readers do not walk into the page with the writer's private understanding. The words have to carry the shape. Readability is therefore a way of transmitting structure, not a softer substitute for it. A reader should not have to reverse-engineer the pattern from padded or abstract phrasing.

That also means readable words cannot rescue weak structure. Smooth language cannot fix a vague summary line or mixed grouping. It can only help the reader absorb a structure that has already been earned. Chapter 10 keeps wording under structural discipline even while turning toward ease of reading.

The practical gain is simple and strong. Once the writer sees the image clearly and copies it faithfully into words, the page becomes easier to move through without sacrificing precision. Chapter 10 closes the sequence by showing how readable language should serve the structure instead of competing with it.`;

const criticReport = `# Chapter 10 Critic Report

- hook quality: 2/2. The opening defines readable wording as the final transmission step after structure has already been earned.
- paragraph-job distinctness: 2/2. The draft separates image creation, word choice, transmission logic, and the limit of readability clearly.
- anchor use: 2/2. Frozen headings remain active and narrowly interpreted.
- chapter specificity: 2/2. The prose stays tied to structural readability rather than generic prose advice.
- easy-mode convertibility: 2/2. Image, copying, transmission, and limits compress cleanly.
- meta-distance: 2/2. The chapter teaches the move directly.
- hard-edge preservation: 1/2. The transmission language is strong, though the validator should keep readability from drifting into broad style preaching.
- conceptual repetition risk: 1/2. Language about clarity can echo earlier chapters unless the image-to-words move stays central.

Score: 12/12

Weakest paragraph:
Paragraph 6. The examples are useful but should stay tightly tied to structural transmission.

Strongest sentence:
"Readability is therefore a way of transmitting structure, not a softer substitute for it."

Contamination phrase or source-splice suspicion:
No contamination phrases detected. No source-splice suspicion.

Decision:
Approved for conversion path. Keep the image-to-words translation central across all surfaces.

Patch guidance:
- preserve the difference between seeing the image and copying it in words
- keep readable wording subordinate to earned structure
- close the main sequence without turning reflective or meta
`;

const quiz = {
  passingScorePercent: 80,
  questions: [
    {
      questionId: 'q01',
      prompt: 'What problem does Chapter 10 address after the structure is already sound?',
      choices: [
        'Whether the source freeze should be changed',
        'Whether the words let the reader receive the structure easily',
        'Whether examples should replace the outline'
      ],
      correctIndex: 1,
      explanation: {
        gentle: 'It focuses on readable expression of an already-earned structure.',
        direct: 'The issue is transmission through words, not structural invention.',
        competitive: 'The structure is earned; the wording still has to carry it.'
      },
      bloomsLevel: 'remember-understand',
      depthLevel: 'easy'
    },
    {
      questionId: 'q02',
      prompt: 'What is the first move Chapter 10 recommends before choosing sentences?',
      choices: [
        'Add more examples to the page',
        'Create a clear image of the structure and relationships',
        'Shorten every sentence automatically'
      ],
      correctIndex: 1,
      explanation: {
        gentle: 'The writer first needs to see the structure clearly.',
        direct: 'Clear wording depends on a clear image of the relationships.',
        competitive: 'See the shape before you try to phrase it.'
      },
      bloomsLevel: 'remember-understand',
      depthLevel: 'easy'
    },
    {
      questionId: 'q03',
      prompt: 'What does it mean to copy the image in words?',
      choices: [
        'Decorate the writing with more adjectives',
        'Replace the structure with smoother language',
        'Preserve the structural picture in the phrasing'
      ],
      correctIndex: 2,
      explanation: {
        gentle: 'The wording should keep the same relationships the writer can already see.',
        direct: 'Phrasing should transmit the structure instead of blurring it.',
        competitive: 'The sentence should carry the shape, not hide it.'
      },
      bloomsLevel: 'remember-understand',
      depthLevel: 'easy'
    },
    {
      questionId: 'q04',
      prompt: 'Why is readability described as a transmission problem?',
      choices: [
        'Because readers dislike all abstraction',
        'Because readers do not already possess the writer’s private structural picture',
        'Because only spoken language can carry structure'
      ],
      correctIndex: 1,
      explanation: {
        gentle: 'The words have to bring the structure across to the reader.',
        direct: 'The reader needs the language to carry the pattern clearly.',
        competitive: 'The reader cannot borrow the writer’s hidden map.'
      },
      bloomsLevel: 'apply-analyze',
      depthLevel: 'medium'
    },
    {
      questionId: 'q05',
      prompt: 'What happens when the writer cannot see the image clearly before drafting?',
      choices: [
        'The structure becomes automatically stronger',
        'The wording often becomes generic or blurry',
        'The page no longer needs a summary line'
      ],
      correctIndex: 1,
      explanation: {
        gentle: 'Unclear image often leads to unclear phrasing.',
        direct: 'Generic wording is often a translation of weak visual understanding.',
        competitive: 'Fog in the image becomes fog in the sentence.'
      },
      bloomsLevel: 'apply-analyze',
      depthLevel: 'medium'
    },
    {
      questionId: 'q06',
      prompt: 'If the relationship is contrast, what should the sentence do?',
      choices: [
        'Hide the difference inside a broad label',
        'Turn the contrast into a sequence automatically',
        'Let the contrast appear clearly in the wording'
      ],
      correctIndex: 2,
      explanation: {
        gentle: 'The words should preserve the contrast instead of flattening it.',
        direct: 'Readable language should match the structural relationship it carries.',
        competitive: 'If the shape is contrast, let the sentence show the clash.'
      },
      bloomsLevel: 'apply-analyze',
      depthLevel: 'medium'
    },
    {
      questionId: 'q07',
      prompt: 'A writer uses smooth, padded language to cover a vague summary line. What is the likely mistake?',
      choices: [
        'The language is too concrete',
        'Readable words are being used as a substitute for structural repair',
        'The page has too much structure'
      ],
      correctIndex: 1,
      explanation: {
        gentle: 'Smooth wording cannot fix a weak structure underneath.',
        direct: 'Readable phrasing helps transmit structure, but it cannot invent it.',
        competitive: 'Polish is being asked to do surgery.'
      },
      bloomsLevel: 'apply-analyze',
      depthLevel: 'medium'
    },
    {
      questionId: 'q08',
      prompt: 'What is the chapter’s hardest warning about readable wording?',
      choices: [
        'Readable words cannot rescue weak structure after the fact',
        'Readable sentences should always be shorter than ten words',
        'Readers never understand abstract terms'
      ],
      correctIndex: 0,
      explanation: {
        gentle: 'Good wording helps only when the structure underneath is already sound.',
        direct: 'Language can transmit earned logic, but it cannot replace it.',
        competitive: 'Polish does not manufacture architecture.'
      },
      bloomsLevel: 'evaluate',
      depthLevel: 'hard'
    },
    {
      questionId: 'q09',
      prompt: 'What practical gain comes from seeing the image clearly and copying it faithfully into words?',
      choices: [
        'The reader can move through the page more easily without losing the structure',
        'The writer no longer needs grouped points',
        'The summary line becomes optional'
      ],
      correctIndex: 0,
      explanation: {
        gentle: 'The page becomes easier to read while keeping its precision.',
        direct: 'Clear wording lets the reader receive the structure without rebuilding it silently.',
        competitive: 'The reader gets the shape without doing unpaid reconstruction.'
      },
      bloomsLevel: 'evaluate',
      depthLevel: 'hard'
    },
    {
      questionId: 'q10',
      prompt: 'How does Chapter 10 close the main sequence?',
      choices: [
        'By showing how readable language should serve an already-earned structure',
        'By replacing structure with style',
        'By reopening the source-selection question'
      ],
      correctIndex: 0,
      explanation: {
        gentle: 'It shows how words should carry the structure clearly to the reader.',
        direct: 'The chapter ends the sequence by translating earned logic into readable phrasing.',
        competitive: 'The close is not style over structure. It is structure speaking clearly.'
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
  chapterId: 'ch10-putting-it-into-readable-words',
  number: 10,
  title: 'Putting it into readable words',
  readingTimeMinutes: 10,
  contentVariants: {
    easy: {
      chapterBreakdown: {
        gentle: `Chapter 10 explains that even a correct structure can still read poorly if the words do not carry that structure clearly. The writer first has to create the image of the relationships. What is changing, contrasting, or causing what? Once that picture is clear, the writer can copy the image in words. That means choosing language that keeps the same structural shape instead of blurring it into generic phrasing. Readability matters because readers do not already know the hidden pattern the writer sees. The words have to bring that pattern across. But readable language is not a substitute for structure. Smooth phrasing cannot rescue a weak grouping or vague summary line. It can only help the reader absorb a structure that has already been earned. The gain is a page that feels clearer because the wording serves the structure instead of competing with it.`,
        direct: `Chapter 10 tests whether the language on the page lets the reader receive an already-earned structure easily. A strong hierarchy can still feel slow or vague if the wording does not preserve the relationships inside it. The first move is to create the image clearly. The writer has to see the pattern before trying to phrase it. The next move is to copy that image in words. If the relationship is sequence, contrast, or cause and result, the sentence should let that relationship appear. Readability is therefore a transmission job. The wording has to carry the structure to the reader without forcing the reader to rebuild it silently. At the same time, the chapter refuses to let readability replace structure. Smooth language helps only when the structure underneath is already sound. Chapter 10 is about making the words serve the logic that earlier chapters already earned.`,
        competitive: `Chapter 10 is where the structure has to start speaking clearly. A sound hierarchy can still hit the page in language that is padded, abstract, or slower than necessary. The fix starts before the sentence. First see the image. Then copy that image in words. If the writer cannot see the structure sharply, the prose usually turns generic because it is translating blur. Readable phrasing means the sentence keeps the same structural shape the writer can already see. Sequence should read like sequence. Contrast should sound like contrast. Cause and result should not be flattened into mush. The reader needs the words to carry the pattern across. But polish is not a rescue device. If the structure is weak, smooth language only hides the weakness for a moment. Chapter 10 closes the sequence by making the words answer to the logic instead of drifting away from it.`
      },
      keyTakeaways: [
        { point: { gentle: 'Readable words should carry an already-earned structure clearly.', direct: 'Good phrasing helps the reader receive structure more easily.', competitive: 'The words have to move the shape across.' } },
        { point: { gentle: 'The writer should create the image first and then copy it in words.', direct: 'Clear wording begins with clear structural seeing.', competitive: 'See it before you say it.' } },
        { point: { gentle: 'Readability cannot replace structural discipline.', direct: 'Smooth language does not repair weak grouping or weak summaries.', competitive: 'Polish is not a structural alibi.' } }
      ],
      oneMinuteRecap: {
        gentle: 'Create the image first, then copy that image into words so the reader can receive the structure clearly.',
        direct: 'Chapter 10 makes wording serve an already-earned structure instead of asking language to invent one.',
        competitive: 'If the words do not carry the shape, the reader pays for the writer’s blur.'
      }
    },
    medium: {
      chapterBreakdown: {
        gentle: `Chapter 10 takes a structure that has already earned its logic and asks whether the wording on the page lets the reader receive it easily. A hierarchy may be correct and still feel clumsy, abstract, or slower than necessary because the language is not carrying the structure clearly enough.\n\nThe first move is to create the image. Before drafting sentences, the writer needs a clear picture of the relationship involved. Is this part of the structure a sequence, a contrast, a cause-and-result chain, or a grouping around one shared effect? If the picture is weak, the wording usually becomes generic because it is translating uncertainty into prose.\n\nThe next move is to copy the image in words. This does not mean decorating the page. It means choosing language that preserves the same structural shape the writer can already see. If the relationship is sequence, the sentence should move. If it is contrast, the difference should remain visible in the wording. If it is cause and result, the sentence should not blur those roles into one broad statement.\n\nReadability matters because readers do not enter the page with the writer's private map already in mind. The words have to bring that pattern across. A reader should not have to reconstruct the structure silently from padded phrasing or abstract labels.\n\nThis is why readability is a transmission issue rather than a cosmetic one. The writer is transferring an earned structural image into the reader's understanding. Better wording makes that transfer faster and cleaner, but only if the structure is already sound.\n\nThe chapter also draws a limit clearly. Readable words cannot rescue weak structure. Smooth phrasing cannot fix a vague summary line or mixed grouping. It can only help the reader absorb logic that the writer has already earned elsewhere.\n\nThe practical result is a page that feels easier to move through without giving up precision. Once the writer sees the image clearly and copies it faithfully into words, the reader receives the structure with less strain and less guesswork.`,
        direct: `Chapter 10 turns from structural testing to structural transmission. The hierarchy may already be sound, the grouping may already be honest, and the summary line may already fit, yet the page can still read badly if the wording does not preserve the relationships clearly. The issue now is whether the reader can take in the structure as easily as the writer can see it.\n\nThe first requirement is to create the image before choosing sentences. The writer has to know what the structure looks like in motion and relationship. Is one point contrasting with another, unfolding after another, or producing another? Without that image, the language tends to default to broad, padded phrases that say less than the structure already knows.\n\nThe next requirement is to copy that image in words. Readable phrasing is not ornament. It is structural fidelity in sentence form. If the relationship is sequence, the wording should preserve sequence. If it is contrast, the sentence should let the difference stand clearly. If it is cause and result, the language should not flatten those jobs into a vague cluster.\n\nThis matters because the reader does not possess the writer's hidden map. The words have to carry the pattern. Readability is therefore a transmission problem. The page succeeds when the wording lets the reader receive the structure without rebuilding it from scratch.\n\nThat also explains the limit of the chapter. Readable language cannot substitute for structure. It cannot rescue a weak grouping or repair a vague top line after the fact. Smooth phrasing only helps when there is already something solid to carry.\n\nThere is also a pressure point inside revision itself. The writer should be able to point to the exact relationship the sentence is carrying and show where it appears in the wording. If that cannot be done, the sentence may still be smoother than before while remaining weaker than the structure deserves.\n\nThe practical gain is stronger comprehension with less reader effort. The page becomes easier to move through because the phrasing now matches the logic already earned beneath it. It also becomes easier to revise honestly because the writer can test the sentence against the underlying image instead of trusting a vague sense of fluency.\n\nChapter 10 closes the sequence by making words answer to structure instead of asking them to compensate for its absence.`,
        competitive: `Chapter 10 is about forcing the prose to carry its own architecture. By this point the hierarchy may be correct, the grouping may be disciplined, and the summary line may be earned. Yet the page can still read like drag if the wording does not preserve the structure cleanly. The reader should not have to do excavation work just because the writer translated a sharp shape into soft language.\n\nThe first move is to create the image before touching the sentence. The writer has to see what is actually happening in the structure. Is the relationship contrast, sequence, or cause and result? Is the grouping a common effect or a set of parallel moves? If that image is weak, the language becomes generic because it is carrying blur from the start.\n\nThe next move is to copy the image in words. This is not decoration. It is structural discipline at the level of phrasing. Sequence should read like sequence. Contrast should hit like contrast. Cause and result should stay separate instead of dissolving into padded abstraction. The sentence is doing its job only when the shape survives translation.\n\nReadability is not a soft side topic. It is a transmission problem. The reader does not get access to the writer's private map for free. The words either move the architecture across or force the reader to rebuild it under strain.\n\nThe limit is severe and necessary. Smooth language cannot rescue weak structure. If the grouping is mixed or the top line is vague, elegant phrasing only hides the defect briefly. The words are not supposed to invent logic that the writer failed to earn.\n\nThe honest sequence is harsher and better. Earn the logic. See the image. Then phrase the sentence so the image survives. That sequence also makes revision more exact because the writer can test the sentence against a visible shape rather than against a mood of fluency.\n\nThe payoff is ruthless and useful. Once the image is clear and the wording copies it faithfully, the reader no longer has to rebuild the shape by force. The paragraph stops sounding clear and starts being clear because the structure now survives contact with the sentence. Chapter 10 closes the sequence by making the prose serve the structure instead of letting it drift into performance.`
      },
      keyTakeaways: [
        { point: { gentle: 'Readable wording is structural transmission.', direct: 'The page has to carry the hierarchy to the reader clearly.', competitive: 'The prose has to transport the architecture.' }, moreDetails: { gentle: 'The reader should not have to reconstruct the pattern silently.', direct: 'Good phrasing reduces reader effort without loosening structural precision.', competitive: 'Do not make the reader do recovery work.' } },
        { point: { gentle: 'Create the image first.', direct: 'Clear phrasing begins with a clear picture of the relationship being expressed.', competitive: 'If the image is blurry, the sentence will be too.' }, moreDetails: { gentle: 'The writer needs to see sequence, contrast, or cause and result before drafting.', direct: 'Generic prose often signals that the structural picture was never clear enough.', competitive: 'Blur upstream becomes mush downstream.' } },
        { point: { gentle: 'Copy the image in words without trying to use style as repair.', direct: 'Readable sentences should preserve the shape already earned by the structure.', competitive: 'Polish is not a substitute for logic.' }, moreDetails: { gentle: 'Better wording helps only when the structure underneath is already solid.', direct: 'Language should serve structure, not compensate for its absence.', competitive: 'Do not ask elegance to do structural labor.' } }
      ],
      activationPrompt: {
        gentle: 'Take one current paragraph and name the structural image before rewriting the sentences.',
        direct: 'Audit one section for whether the wording actually preserves the sequence, contrast, or cause-and-result shape you intended.',
        competitive: 'Pick one clumsy paragraph and force the sentence to carry the shape it claims to express.'
      },
      selfCheckPrompt: {
        gentle: 'Why is readability a transmission problem rather than just a style problem?',
        direct: 'What goes wrong when the words do not preserve the structure the writer already sees?',
        competitive: 'How does good logic still die in soft language?'
      },
      oneMinuteRecap: {
        retrieve: {
          gentle: 'What should the writer create before choosing the final wording?',
          direct: 'Why does the chapter insist on creating the image first?',
          competitive: 'What has to be sharp before the sentence can be?'
        },
        connect: {
          gentle: 'How do image and wording work together?',
          direct: 'Why does copying the image in words improve readability without weakening structure?',
          competitive: 'Connect the chain: clear image, faithful sentence, easier reading.'
        },
        preview: {
          gentle: 'How does this chapter close the sequence?',
          direct: 'What larger problem has now been resolved by the end of Chapter 10?',
          competitive: 'What has the book forced words to do by the finish?'
        }
      }
    },
    hard: {
      chapterBreakdown: {
        gentle: `Chapter 10 assumes that the structure has already earned its place and asks whether the wording now lets the reader receive that structure cleanly. A hierarchy can be correct and still read badly if the language arrives padded, abstract, or misaligned with the relationships it is supposed to carry. The writer therefore has to treat readable words as a structural responsibility, not a final cosmetic pass.\n\nThe first task is to create the image. Before the sentence can be clear, the writer has to see the pattern clearly. Is the relationship one of sequence, contrast, cause and result, or grouped similarity? If the picture remains weak, the wording often becomes broad because the writer is trying to translate an uncertain structure into language.\n\nOnce the image is clear, the next task is to copy that image in words. This means preserving the same structural shape in phrasing. Sequence should read like movement. Contrast should read like difference. Cause and result should remain visibly distinct. A sentence fails when it flattens those relationships into a foggy summary that forces the reader to rebuild the pattern silently.\n\nThis is why readability is not merely a style preference. The reader does not arrive with access to the writer's private image of the structure. The words have to carry that image across. Readability is therefore about transmission. The page works when the sentence lets the reader absorb the structure without wasteful reconstruction.\n\nThe chapter also marks a strict limit. Readable language cannot rescue weak structure. If the grouping is mixed or the summary line is vague, smoother prose will only hide the weakness briefly. The writer cannot ask sentence rhythm or graceful diction to invent coherence that the logic has not already earned.\n\nExamples make this practical. A manager can hide agency and movement under abstract nouns. A student can translate a sharp distinction into broad academic fog. A household plan can soften a direct causal change into language that sounds pleasant but carries little shape. In each case the cure is the same: return to the image, then write from that image instead of from verbal habit.\n\nThe result is a page that feels easier because it is more faithful. The reader no longer has to infer the structure from blurred language. The sentence has already done that work honestly.\n\nChapter 10 closes the main sequence by showing that words are not an independent layer floating above structure. They are the vehicle that either carries earned logic clearly or drops it before it reaches the reader.`,
        direct: `Chapter 10 moves from earning structure to transmitting it. By now the hierarchy may be correct, the grouping may be disciplined, and the summary line may be precise, yet the page can still fail if the language does not preserve those relationships clearly enough for the reader to absorb them. A sound structure can therefore be weakened at the last stage by phrasing that is abstract, padded, or indifferent to shape.\n\nThe first requirement is to create the image before choosing words. The writer needs a clear internal picture of what the structure is doing. Is it sequencing steps, contrasting alternatives, linking cause to result, or showing points that share one common effect? If that image is unclear, the wording will often become generic because it is translating blur.\n\nThe second requirement is to copy that image in words. Readable phrasing is not ornament added on top of logic. It is the act of preserving the structure in sentence form. If the relationship is contrast, the difference has to remain visible in the wording. If it is sequence, the sentence should move in sequence. If it is cause and result, the language should not compress those jobs into a vague label.\n\nThis is why readability is best understood as transmission rather than as style in isolation. The reader does not possess the writer's hidden map. The words have to deliver the pattern. Good phrasing reduces the amount of structural reconstruction the reader has to perform silently.\n\nThat clarity also has a strict limit. Readable language cannot replace structural discipline. It cannot repair a mixed grouping or rescue a vague top line after the fact. Smooth prose only helps when there is already something precise to carry.\n\nThe chapter's practical force lies in that boundary. It gives the writer a way to improve clarity without pretending that clarity and structure are the same job. The writer first earns the logic, then sees the image, then translates that image into words that preserve it.\n\nThe result is stronger reading with less friction. The reader receives the architecture more directly because the phrasing now matches the structure instead of obscuring it. The page becomes easier not because it has been simplified carelessly, but because the wording has become more faithful.\n\nChapter 10 therefore closes the sequence by making readable words answerable to the same rigor that governed grouping, order, process, and summary. Language becomes the final carrier of earned structure, not its substitute.`,
        competitive: `Chapter 10 is where the prose has to stop freelancing. By this point the structure may be earned, the grouping may be clean, and the top line may finally fit. Yet the page can still underperform if the wording does not carry that architecture sharply enough. Good logic can still die in weak phrasing.\n\nThe first move is to create the image before the sentence begins. The writer has to know what the structure is doing in visible terms. Is it moving in sequence, splitting in contrast, or driving from cause to result? If the image is blurry, the wording usually goes generic because the sentence is translating uncertainty instead of shape.\n\nThe next move is to copy that image in words. This is not decoration. It is obedience to structure at the sentence level. Sequence should read like sequence. Contrast should strike as contrast. Cause and result should remain distinct instead of dissolving into soft abstraction. If the shape disappears in translation, the prose has failed even if the underlying outline was sound.\n\nThat is why readability is not a soft side topic. It is a transmission problem. The reader does not get access to the writer's private map for free. The words either move the architecture across or force the reader to rebuild it under strain.\n\nThe limit matters just as much. Smooth prose cannot rescue weak structure. It cannot make mixed points coherent or vague claims precise. At best it hides the defect for a moment. At worst it makes a structural failure harder to notice.\n\nThe honest sequence is harsher and better. Earn the logic. See the image. Then phrase the sentence so the image survives. That is how readability becomes useful without becoming dishonest.\n\nThe payoff is severe and practical. Once the sentence carries the same shape the writer can see, the reader stops paying for the writer's blur. Chapter 10 closes the main sequence by forcing language to serve architecture instead of drifting into performance that only sounds clear.`
      },
      keyTakeaways: [
        { point: { gentle: 'Readable words are responsible for carrying structure across.', direct: 'Language is the final transmission layer of earned logic.', competitive: 'The prose is the transport system for the architecture.' }, moreDetails: { gentle: 'The page works better when the reader does not have to reconstruct the pattern silently.', direct: 'Readability reduces friction by preserving structural shape in phrasing.', competitive: 'Do not invoice the reader for reconstruction work.' } },
        { point: { gentle: 'Create the image before choosing the sentence.', direct: 'A clear structural picture has to come before clear wording.', competitive: 'If the image is foggy, the sentence will lie.' }, moreDetails: { gentle: 'The writer needs to see sequence, contrast, or cause and result clearly first.', direct: 'Generic language is often a symptom of structural blur upstream.', competitive: 'Blur breeds mush.' } },
        { point: { gentle: 'Copy the image in words faithfully.', direct: 'Sentence form should preserve the same relationships already earned by the structure.', competitive: 'The sentence has to keep the shape alive.' }, moreDetails: { gentle: 'Readable wording should not flatten contrast, sequence, or causal movement.', direct: 'The sentence succeeds when the structure survives translation intact.', competitive: 'If the shape dies in phrasing, the prose failed.' } },
        { point: { gentle: 'Readability has a strict limit.', direct: 'Good wording cannot repair weak grouping or vague summary after the fact.', competitive: 'Polish does not do structural salvage.' }, moreDetails: { gentle: 'Better phrasing helps only when there is already solid logic underneath it.', direct: 'Language serves structure; it does not invent missing coherence.', competitive: 'Elegant blur is still blur.' } },
        { point: { gentle: 'The end goal is faithful ease.', direct: 'The page becomes easier because the language now matches the architecture.', competitive: 'The reader gets clean shape instead of soft performance.' }, moreDetails: { gentle: 'Clarity and precision stay together when wording follows the image honestly.', direct: 'Ease of reading should come from structural fidelity, not careless simplification.', competitive: 'Make it easy by making it true.' } }
      ],
      activationPrompt: {
        gentle: 'Take one paragraph and describe its structural image before rewriting the sentences.',
        direct: 'Test one section for whether the wording preserves sequence, contrast, or cause and result as clearly as the structure does.',
        competitive: 'Take one muddy paragraph apart and force the sentence to carry the actual shape.'
      },
      selfCheckPrompts: [
        {
          gentle: 'Why can correct structure still read badly on the page?',
          direct: 'What happens when wording fails to preserve the image of the structure?',
          competitive: 'How does good logic still die in lazy prose?'
        },
        {
          gentle: 'Why is readability not a substitute for structure?',
          direct: 'What can wording improve, and what can it not repair?',
          competitive: 'Where does polish stop being useful and start becoming cover?'
        }
      ],
      predictionPrompt: {
        gentle: 'What has the book forced words to do by the end of this chapter?',
        direct: 'How does Chapter 10 finish the main sequence of structural discipline?',
        competitive: 'What job has the prose finally been forced to perform?'
      },
      oneMinuteRecap: {
        retrieve: {
          gentle: 'What should the writer create before phrasing the paragraph?',
          direct: 'What has to exist before the sentence can carry structure well?',
          competitive: 'What must be sharp before the prose gets its chance?'
        },
        connect: {
          gentle: 'How do image and wording work together to improve readability?',
          direct: 'Why does faithful translation of the image reduce reader effort without weakening precision?',
          competitive: 'Connect the chain: earned logic, clear image, faithful sentence, lower friction.'
        },
        preview: {
          gentle: 'How does this chapter close the sequence?',
          direct: 'What has readable language now been made accountable to?',
          competitive: 'By the finish, who is the prose finally serving?'
        }
      }
    }
  },
  examples: [
    {
      exampleId: 'ch10-ex01-status-update',
      title: 'Lena Rewrites a Clumsy Sequence So the Reader Can Follow It',
      category: 'work',
      format: 'rewrite_choice',
      endingType: 'clarity',
      scenario: {
        gentle: 'Lena has the right steps in her update, but the paragraph does not let the sequence come through clearly.',
        direct: 'Her wording blurs a good sequence into padded prose.',
        competitive: 'Lena buried a clean sequence under soft language.'
      },
      whatToDo: {
        gentle: 'See the sequence clearly and rewrite the paragraph so the wording carries that movement.',
        direct: 'Copy the step-by-step image into words instead of relying on broad summary language.',
        competitive: 'Make the sentence walk in the same order as the logic.'
      },
      whyItMatters: {
        gentle: 'The reader can follow the update with less effort.',
        direct: 'The language now transmits the structure instead of obscuring it.',
        competitive: 'The page stops making the reader excavate.'
      }
    },
    {
      exampleId: 'ch10-ex02-contrast-slide',
      title: 'Marco Lets the Contrast Appear Instead of Flattening It',
      category: 'work',
      format: 'comparison',
      endingType: 'insight',
      scenario: {
        gentle: 'Marco has a real contrast in his points, but the phrasing makes both sides sound the same.',
        direct: 'His sentence flattens a contrast that the structure had already earned.',
        competitive: 'Marco turned a clean clash into mush.'
      },
      whatToDo: {
        gentle: 'Rewrite so the difference between the two sides stays visible in the sentence.',
        direct: 'Copy the contrast into the wording instead of compressing it into a broad label.',
        competitive: 'Let the sentence hit with the same split the structure already has.'
      },
      whyItMatters: {
        gentle: 'The reader sees the contrast faster and more clearly.',
        direct: 'The sentence now preserves the exact relationship the outline was carrying.',
        competitive: 'The prose stops dulling the blade.'
      }
    },
    {
      exampleId: 'ch10-ex03-thesis-paragraph',
      title: 'Ava Writes the Cause and Result So the Thesis Still Holds',
      category: 'school',
      format: 'diagnostic_snapshot',
      endingType: 'confidence',
      scenario: {
        gentle: 'Ava knows the cause-and-result relationship in her argument, but the paragraph blends the two jobs together.',
        direct: 'Her wording hides the causal shape the structure already established.',
        competitive: 'Ava let cause and result dissolve into academic fog.'
      },
      whatToDo: {
        gentle: 'See the causal image clearly and rewrite so cause and result stay distinct.',
        direct: 'Preserve the relationship in the sentence instead of flattening it into abstraction.',
        competitive: 'Keep the engine and the outcome in separate gears.'
      },
      whyItMatters: {
        gentle: 'The reader can follow the argument more easily.',
        direct: 'The language now carries the causal logic cleanly.',
        competitive: 'The paragraph stops smearing the mechanism.'
      }
    },
    {
      exampleId: 'ch10-ex04-study-summary',
      title: 'Noah Stops Translating a Sharp Idea into Generic Study Language',
      category: 'school',
      format: 'decision_point',
      endingType: 'relief',
      scenario: {
        gentle: 'Noah has a clear idea, but his draft turns it into broad, familiar phrases.',
        direct: 'His wording is weaker than the structure he already understands.',
        competitive: 'Noah traded a sharp idea for canned prose.'
      },
      whatToDo: {
        gentle: 'Return to the image and rewrite the sentence around the real relationship.',
        direct: 'Use words that preserve the structure instead of defaulting to academic padding.',
        competitive: 'Stop writing the habit and write the shape.'
      },
      whyItMatters: {
        gentle: 'The sentence becomes easier to grasp without losing precision.',
        direct: 'The prose finally carries the structure that was already present.',
        competitive: 'The idea stops losing altitude in translation.'
      }
    },
    {
      exampleId: 'ch10-ex05-budget-plan',
      title: 'Mina Makes a Household Plan Read as Clearly as It Is Structured',
      category: 'personal',
      format: 'planning_note',
      endingType: 'clarity',
      scenario: {
        gentle: 'Mina has a clear household plan, but the wording is softer and blurrier than the structure itself.',
        direct: 'Her plan reads harder than it should because the sentences do not carry the shape cleanly.',
        competitive: 'Mina built a clean plan and then wrapped it in fog.'
      },
      whatToDo: {
        gentle: 'See the plan image clearly and rewrite so the sentences preserve that shape.',
        direct: 'Translate the sequence and cause-and-result links into direct wording.',
        competitive: 'Make the words carry the same spine as the plan.'
      },
      whyItMatters: {
        gentle: 'The plan becomes easier for others to follow.',
        direct: 'The reader no longer has to infer the structure from vague language.',
        competitive: 'The page quits leaking logic.'
      }
    },
    {
      exampleId: 'ch10-ex06-repair-note',
      title: 'Sam Stops Using Pleasant Language to Hide an Unclear Image',
      category: 'personal',
      format: 'coaching_moment',
      endingType: 'insight',
      scenario: {
        gentle: 'Sam keeps rewriting the sentence smoothly, but the note still feels unclear.',
        direct: 'The problem is not polish anymore. The structural image itself has not been made explicit enough.',
        competitive: 'Sam is buffing the sentence instead of seeing the shape.'
      },
      whatToDo: {
        gentle: 'Step back, create the image first, and then write from that picture.',
        direct: 'Stop polishing blind wording and rebuild the sentence from a visible structural relationship.',
        competitive: 'See it first. Then say it.'
      },
      whyItMatters: {
        gentle: 'The next draft becomes clearer because it is built from structure, not habit.',
        direct: 'A faithful sentence appears faster once the image is explicit.',
        competitive: 'The prose stops performing clarity and starts delivering it.'
      }
    }
  ],
  quiz,
  implementationPlan: {
    coreSkill: {
      gentle: 'The core skill is seeing the structural image clearly and then copying that image into readable words.',
      direct: 'Chapter 10 trains the writer to transmit earned structure through faithful phrasing.',
      competitive: 'The skill is making the sentence carry the architecture.'
    },
    ifThenPlans: [
      {
        context: 'work',
        plan: {
          gentle: 'If a section reads clumsily, then define the structural image first before rewriting the paragraph.',
          direct: 'If the wording is padded, ask whether the sentence is still carrying sequence, contrast, or cause clearly.',
          competitive: 'If the prose drags, stop polishing and recover the shape.'
        }
      },
      {
        context: 'school',
        plan: {
          gentle: 'If your paragraph feels abstract, then restate the structural image before choosing final wording.',
          direct: 'If the sentence blurs the argument, rewrite from the relationship instead of from broad academic habit.',
          competitive: 'If the paragraph went soft, rebuild it from the structure.'
        }
      },
      {
        context: 'personal',
        plan: {
          gentle: 'If your plan reads less clearly than it is organized, then rewrite from the image of the steps or causes.',
          direct: 'If the wording is gentler than the logic, make the sentence preserve the plan’s actual shape.',
          competitive: 'If the page is foggier than the plan, make the words carry the spine.'
        }
      }
    ],
    twentyFourHourChallenge: {
      gentle: 'Within the next day, take one structured paragraph and rewrite it only after naming its image clearly.',
      direct: 'In the next 24 hours, test one paragraph for whether the words actually preserve the relationship you intended.',
      competitive: 'Before tomorrow ends, force one muddy paragraph to carry its true shape.'
    },
    weeklyPractice: {
      gentle: 'Once this week, rewrite one section by creating the image first and then copying that image into words.',
      direct: 'Run one weekly wording drill: identify the structural relationship first, then test whether the sentence still carries it.',
      competitive: 'This week, stop polishing blur and make the sentence serve the architecture.'
    }
  },
  reviewCards: [
    {
      cardId: 'ch10-rc01',
      difficulty: 'easy',
      front: {
        gentle: 'What problem does Chapter 10 address?',
        direct: 'What is under pressure after the structure is already sound?',
        competitive: 'What still has to work after the logic is earned?'
      },
      back: {
        gentle: 'It addresses whether the words let the reader receive the structure clearly.',
        direct: 'It tests readable expression of earned structure.',
        competitive: 'The prose still has to carry the architecture.'
      }
    },
    {
      cardId: 'ch10-rc02',
      difficulty: 'easy',
      front: {
        gentle: 'What should the writer do before choosing final wording?',
        direct: 'What comes before the sentence?',
        competitive: 'What has to be visible before the prose gets a turn?'
      },
      back: {
        gentle: 'Create the image of the structure and relationships first.',
        direct: 'The writer should see the structural picture clearly before drafting phrasing.',
        competitive: 'See the shape before you write the sentence.'
      }
    },
    {
      cardId: 'ch10-rc03',
      difficulty: 'medium',
      front: {
        gentle: 'What does it mean to copy the image in words?',
        direct: 'How should the sentence treat the structural relationship?',
        competitive: 'What job does the sentence have besides sounding smooth?'
      },
      back: {
        gentle: 'It means preserving the same relationship in the wording.',
        direct: 'The sentence should carry sequence, contrast, or cause and result faithfully.',
        competitive: 'The prose has to keep the shape alive.'
      }
    },
    {
      cardId: 'ch10-rc04',
      difficulty: 'medium',
      front: {
        gentle: 'Why is readability a transmission problem?',
        direct: 'Why can the reader not rely on the writer’s hidden understanding?',
        competitive: 'Why does the page have to deliver the map on its own?'
      },
      back: {
        gentle: 'Because the words have to carry the structure to the reader.',
        direct: 'The reader needs the sentence to deliver the pattern clearly.',
        competitive: 'The reader does not get the writer’s private map for free.'
      }
    },
    {
      cardId: 'ch10-rc05',
      difficulty: 'hard',
      front: {
        gentle: 'Why can readable words not rescue weak structure?',
        direct: 'What limit does Chapter 10 put on good phrasing?',
        competitive: 'Where does polish stop being useful?'
      },
      back: {
        gentle: 'Because smooth language cannot invent structure that was never earned.',
        direct: 'Wording can transmit good logic, but it cannot repair mixed grouping or vague claims after the fact.',
        competitive: 'Polish does not do structural salvage.'
      }
    }
  ],
  keyTakeawayCard: {
    gentle: 'Chapter 10 says the writer should first see the structure clearly and then copy that image into readable words.',
    direct: 'The core move is making the sentence transmit an already-earned structure without blurring it.',
    competitive: 'Chapter 10 makes one demand: let the prose carry the architecture cleanly.'
  }
};

function write(rel, content) {
  const file = path.join(runRoot, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

write('drafts/canonical/ch10.md', canonicalDraft + '\n');
write('drafts/edited/ch10.md', editedDraft + '\n');
write('reports/ch10.critic.md', criticReport);
write('structured/ch10.chapter.json', JSON.stringify(chapter, null, 2) + '\n');
write('quizzes/ch10.quiz.json', JSON.stringify(quiz, null, 2) + '\n');
