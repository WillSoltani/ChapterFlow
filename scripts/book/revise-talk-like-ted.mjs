import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";

const packagePath = resolve(process.cwd(), "book-packages/talk-like-ted.modern.json");
const reportPath = resolve(process.cwd(), "notes/talk-like-ted-revision-report.md");

const t = (base, balanced = "", deep = "") => ({ base, balanced, deep });

const compose = (value, level) =>
  [value.base, level !== "easy" ? value.balanced : "", level === "hard" ? value.deep : ""]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

const bullet = (text, base, balanced = "", deep = "") => ({
  text,
  detail: t(base, balanced, deep),
});

const example = (exampleId, title, contexts, scenario, whatToDo, whyItMatters) => ({
  exampleId,
  title,
  contexts,
  scenario,
  whatToDo,
  whyItMatters,
});

const question = (questionId, prompt, choices, correctAnswerIndex, explanation) => ({
  questionId,
  prompt: sanitizePrompt(prompt),
  choices,
  correctAnswerIndex,
  explanation,
});

const sanitizePrompt = (value) =>
  value
    .replace(/\bthis chapter's\b/gi, "this idea")
    .replace(/\bthis chapter\b/gi, "this idea")
    .replace(/\bthe chapter\b/gi, "the idea")
    .replace(/\bthis reading\b/gi, "this idea")
    .replace(/\bthe reading\b/gi, "the idea")
    .replace(/\s+/g, " ")
    .trim();

const DEFAULT_SIMPLE_INDEXES = [0, 1, 2, 4, 5, 7, 9];

const SCENARIO_WRONG_BANK = [
  "Add more information and hope the audience figures out the point on its own.",
  "Polish the wording until it sounds impressive even if it feels less natural.",
  "Keep every detail so no one can say the talk was incomplete.",
  "Use the most dramatic move available even if it distracts from the idea.",
  "Copy the style of a famous speaker even if it does not fit you.",
  "Let the slides carry the message so your delivery matters less.",
  "Avoid surprise and emotion so the talk sounds more serious.",
  "Memorize exact lines and repeat them the same way no matter how the room responds.",
];

const AUDIT_SUMMARY = [
  "The existing Talk Like TED package was not publishable. The book itself has a clear and distinctive communication framework, but the current package reduced that framework to generic template prose that repeated the same patterns across nearly every chapter.",
  "The summaries were especially weak. Paragraph two was essentially the same in every chapter, which erased the actual logic of the book and made nine different lessons sound like one recycled lesson about vague decision making.",
  "The bullet sets were repetitive, the scenarios reused the same flat shell with only a few nouns changed, and the quizzes relied on formula prompts instead of authentic applied judgment. The result did not feel like a guided lesson. It felt like placeholder content wearing book specific titles.",
  "The motivation layer was also mismatched to the book. Generic tone tails about conflict and pressure did not fit a communication title built around connection, memorability, and audience experience. This revision therefore replaces the book package chapter by chapter and adds book specific motivation handling in the reader.",
];

const MAIN_PROBLEMS = [
  "Summaries repeated generic structure instead of explaining the real lesson of each chapter.",
  "Bullet points often sounded like slogans and reused the same detail language across the whole book.",
  "Scenarios were too similar to one another and rarely showed believable transfer of the actual speaking principle.",
  "Quiz prompts were formulaic and tested recognition of a template instead of understanding of the lesson.",
  "Depth variation was weak because the content did not create a meaningful jump from Simple to Standard to Deeper.",
  "Motivation personalization felt fake because the tone logic was generic and not tailored to a speaking and storytelling book.",
];

const PERSONALIZATION_STRATEGY = [
  "Depth remains the authored content axis. Simple now uses seven strong bullets for fast understanding, Standard uses ten complete bullets as the premium default, and Deeper uses fifteen bullets that add real nuance about audience psychology, preparation, tradeoffs, and transfer.",
  "Motivation remains a guidance axis rather than nine duplicated book files. The package keeps the core lesson stable while the reader applies Talk Like TED specific coaching language to summary framing, scenario guidance, recap language, and quiz explanations.",
  "Gentle for this book emphasizes calm human connection, Direct emphasizes clarity and disciplined editing, and Competitive emphasizes the edge that comes from being memorable in rooms full of forgettable talks.",
  "This approach keeps the schema lean, preserves fidelity, and still makes the user experience across Simple, Standard, Deeper and Gentle, Direct, Competitive feel materially different.",
];

const SCHEMA_NOTE =
  "No package schema change was required. The revision stays inside the current JSON shape. Depth is authored in the package, and motivation is handled in the reader through Talk Like TED specific guidance instead of nine duplicated package variants.";

const CHAPTER_REVISIONS = [
  chapter({
    chapterId: "ch01-passion-first",
    number: 1,
    title: "Speak From Genuine Conviction",
    readingTimeMinutes: 13,
    summary: {
      p1: t(
        "Great talks start with genuine conviction because audiences can tell when a speaker cares about the idea instead of merely delivering information.",
        "Gallo argues that passion is not decorative energy. It shapes voice, emphasis, and the willingness to do the hard editorial work that a memorable talk requires.",
        "The point is not to perform excitement. It is to build the talk around an idea that matters enough to you that the room feels invited into a real belief."
      ),
      p2: t(
        "This matters because people rarely remember a talk that felt emotionally empty, even if the facts were accurate.",
        "In real life, that means choosing the part of the topic you truly care about, clarifying why it matters, and letting that reason guide the structure of the talk.",
        "The deeper lesson is that conviction improves judgment as much as delivery. When you know what matters most, you cut weaker points, speak with cleaner emphasis, and make it easier for others to believe the idea deserves their attention."
      ),
    },
    standardBullets: [
      bullet(
        "Start with real stake. The strongest talks begin with an idea the speaker truly cares about.",
        "Audiences notice emotional truth quickly, and that visible belief makes the message easier to trust.",
        "When the topic matters to you, your voice, examples, and emphasis stop feeling borrowed.",
        "Conviction also helps you decide what belongs in the talk and what should be cut."
      ),
      bullet(
        "Passion is not polish. Gallo treats passion as the source of energy, not as a showy extra.",
        "It gives ordinary words force because the room senses the speaker is invested in the outcome.",
        "That is different from loudness or hype, which can feel empty if the belief underneath is thin.",
        "Real conviction can be calm, serious, playful, or urgent as long as it is genuine."
      ),
      bullet(
        "Find the personal connection. Before building slides, name why the idea matters to you.",
        "That reason becomes the emotional core of the talk and keeps the message from drifting into generic information.",
        "A short sentence about why you care can guide your opening, your story choice, and your closing.",
        "Speakers often skip this step and then wonder why the talk sounds technically correct but emotionally flat."
      ),
      bullet(
        "Do not fake enthusiasm. Audiences are usually more forgiving of quiet sincerity than forced excitement.",
        "If you imitate someone else's energy, the delivery can feel performed instead of shared.",
        "The goal is not to act passionate. It is to speak from a belief you can honestly carry.",
        "This is why authenticity and self knowledge matter before stage technique."
      ),
      bullet(
        "Let conviction sharpen the message. Caring deeply should make the talk clearer, not more crowded.",
        "When you know what matters most, you can cut extra points that weaken the main idea.",
        "Strong speakers protect the audience from their own urge to say everything they know.",
        "Passion without editing becomes self expression. Passion with editing becomes persuasion."
      ),
      bullet(
        "Emotion and evidence belong together. Genuine conviction works best when it is backed by substance.",
        "Feeling draws attention, but proof helps the audience stay with the idea after the first emotional impression.",
        "The book does not ask you to replace facts with feeling. It asks you to let facts ride on living belief.",
        "That blend is what makes a talk memorable without making it sloppy."
      ),
      bullet(
        "Practice until the belief sounds natural. Rehearsal should help your conviction come through more clearly.",
        "When the structure is familiar, you can spend more attention on connection and emphasis.",
        "Practice is not there to flatten spontaneity. It is there to remove friction.",
        "The more comfortable you are with the talk, the easier it is to sound like yourself under pressure."
      ),
      bullet(
        "Audience connection starts inside the speaker. People respond when they feel invited into a real concern.",
        "A talk lands better when the room senses that the idea matters beyond the performance itself.",
        "This is why passion can increase trust even before the audience fully agrees.",
        "Visible belief signals that the speaker is offering something lived, not merely assembled."
      ),
      bullet(
        "Choose angles that reward belief. You do not need passion for every inch of a topic, but you do need one real reason to care.",
        "Even assigned topics become stronger when you locate the part that genuinely matters to you or to the people you serve.",
        "That move prevents the talk from sounding like generic obligation.",
        "Finding the right angle is often the difference between flat competence and real presence."
      ),
      bullet(
        "Conviction is a strategic advantage. When the idea feels alive to you, it is far more likely to feel alive to others.",
        "That does not guarantee a great talk, but it gives every later technique something real to amplify.",
        "The rest of the book builds on this point because technique matters most when it serves genuine belief.",
        "A premium talk is not just well built. It carries a reason to care."
      ),
    ],
    deeperBullets: [
      bullet(
        "Passion often reveals the one idea. Strong feeling can show which point truly deserves the center of the talk.",
        "Many speakers discover their through line only after they ask what they most want the audience to care about."
      ),
      bullet(
        "Borrowed ambition sounds thin. Talks lose force when the topic was chosen only because it seems impressive.",
        "Status can supply a subject, but it rarely supplies the energy that makes a message memorable."
      ),
      bullet(
        "Conviction changes body language before words. Energy, pace, and emphasis become easier to believe when they grow from real interest.",
        "A speaker who genuinely cares usually needs fewer tricks because the signals align on their own."
      ),
      bullet(
        "The room often mirrors the speaker. Audiences tend to give back the level of attention they feel from the stage.",
        "When the speaker is mentally absent, listeners often become absent too."
      ),
      bullet(
        "The first persuasion task is self persuasion. If you cannot answer why the idea matters, the audience will feel that gap.",
        "Clarity about your own stake is what makes later structure, story, and delivery feel anchored instead of improvised."
      ),
    ],
    takeaways: [
      "Conviction gives a talk energy",
      "Passion sharpens editing",
      "Audience trust follows visible belief",
      "One clear stake beats borrowed enthusiasm",
      "Evidence should ride on conviction",
      "Real connection is more memorable than polish",
    ],
    practice: [
      "Write why this idea matters to you",
      "Choose one claim you care enough to defend",
      "Cut points that do not serve the main belief",
      "Rehearse aloud until the energy sounds natural",
    ],
    examples: [
      example(
        "ch01-ex01",
        "Science fair opener",
        ["school"],
        "A student built a water quality project after her younger brother got sick from a bad camping trip, but her presentation opens with definitions and lab terms. The class understands the topic, but nobody feels why the project matters.",
        [
          "Open with the moment that made the issue personal to you.",
          "Then connect that moment to the evidence you want the class to understand."
        ],
        "The hidden problem is not lack of information. It is lack of visible stake. Conviction turns the facts from a school report into a message worth caring about."
      ),
      example(
        "ch01-ex02",
        "Debate that feels flat",
        ["school"],
        "A student is arguing for later school start times, but he sounds detached because he is trying to imitate formal debate language. His points are reasonable, yet the room does not feel any urgency.",
        [
          "Say plainly why the issue matters to students instead of hiding behind generic phrasing.",
          "Use one concrete experience that shows you mean what you are saying."
        ],
        "People trust seriousness more when they hear a real stake. The point is not to become dramatic. It is to stop speaking as if the issue belongs to no one."
      ),
      example(
        "ch01-ex03",
        "Product pitch with no spark",
        ["work"],
        "A product manager is pitching an accessibility feature, but the deck begins with roadmap labels and stakeholder jargon. She actually cares deeply about the users who keep dropping out, yet that concern never reaches the room.",
        [
          "Lead with the user problem that genuinely bothers you.",
          "Let that concern shape the talk before you move into roadmap detail."
        ],
        "Conviction gives technical content purpose. When the room sees what you are trying to protect, the feature stops sounding like a random request."
      ),
      example(
        "ch01-ex04",
        "Status update nobody remembers",
        ["work"],
        "A team lead gives a quarterly update on customer churn. He includes every metric he collected, but the talk sounds like inventory instead of leadership.",
        [
          "Frame the update around the outcome you believe the team must protect.",
          "Cut any metric that does not strengthen that central concern."
        ],
        "Caring about the message should narrow the talk, not inflate it. Visible conviction helps people see what deserves their attention first."
      ),
      example(
        "ch01-ex05",
        "Wedding toast by committee",
        ["personal"],
        "A best friend writes a wedding toast with safe facts and polite compliments because she is scared of sounding too emotional. The result is accurate but forgettable.",
        [
          "Choose the one truth about the couple you most want everyone to feel.",
          "Build the toast around that truth instead of trying to cover everything."
        ],
        "A toast becomes memorable when the speaker is willing to stand inside a real feeling. That focus gives the audience something genuine to carry."
      ),
      example(
        "ch01-ex06",
        "Community meeting request",
        ["personal"],
        "A neighbor wants people to volunteer for a park cleanup, but he sounds procedural and distant. Residents hear the logistics and ignore the cause.",
        [
          "Tell the room why the park matters to you personally.",
          "Use that reason to invite people into the effort before you discuss the schedule."
        ],
        "People respond to a living reason more than to a list of tasks. Genuine conviction helps ordinary requests sound worth joining."
      ),
    ],
    directQuestions: [
      question(
        "ch01-q01",
        "What most often separates a technically competent talk from one that actually moves people?",
        [
          "Visible conviction behind the idea",
          "More formal language",
          "Denser evidence",
          "A faster delivery pace"
        ],
        0,
        "Genuine conviction gives the message emotional force and makes the rest of the talk easier to believe."
      ),
      question(
        "ch01-q02",
        "A speaker knows the material well but still sounds flat. What is the likeliest missing piece?",
        [
          "A clearer personal stake in the idea",
          "A more complex slide design",
          "Additional background history",
          "A longer introduction"
        ],
        0,
        "When the audience cannot feel why the idea matters to the speaker, even accurate content can land weakly."
      ),
      question(
        "ch01-q03",
        "When does passion start hurting a talk instead of helping it?",
        [
          "When the speaker lets feeling replace all structure and editing",
          "When the opening is personal",
          "When the speaker practices out loud",
          "When the audience asks questions"
        ],
        0,
        "The book does not celebrate emotional overflow. Conviction is strongest when it sharpens the message."
      ),
      question(
        "ch01-q04",
        "A speaker keeps adding points because the subject matters deeply to her. What would a stronger speaker do?",
        [
          "Choose the few points that best express the real stake",
          "Keep all the points so the room can see her dedication",
          "Replace the data with stories only",
          "Copy a more energetic speaking style"
        ],
        0,
        "Strong conviction improves selection. Caring deeply should help a speaker protect the main idea from dilution."
      ),
    ],
  }),
  chapter({
    chapterId: "ch02-story-structure",
    number: 2,
    title: "Stories Make Ideas Land",
    readingTimeMinutes: 14,
    summary: {
      p1: t(
        "Stories make ideas land because they give information a human sequence that people can picture, feel, and remember.",
        "Gallo argues that stories are not ornamental breaks from the content. They are one of the main ways content becomes meaningful.",
        "A fact can inform, but a story lets the audience experience the fact through character, tension, and change."
      ),
      p2: t(
        "This matters because most audiences do not hold onto isolated claims for long. They remember moments, people, stakes, and outcomes.",
        "In real settings, that means choosing short stories that illuminate the main idea instead of stacking abstract explanations.",
        "The deeper lesson is that stories do more than entertain. They organize meaning, reduce resistance, and give the listener a structure they can carry into later decisions."
      ),
    },
    standardBullets: [
      bullet(
        "Stories carry ideas. A strong story gives the audience a person, a tension, and an outcome to follow.",
        "That structure makes the message easier to understand because people can track what changed and why it mattered.",
        "The point is not fiction. It is sequence. Stories give information a shape the mind naturally holds.",
        "When listeners can follow a human arc, abstract claims start feeling real instead of distant."
      ),
      bullet(
        "Use story to explain, not decorate. The best story serves the core message instead of interrupting it.",
        "A story earns its place when it clarifies the point faster or more deeply than another minute of explanation would.",
        "If the story could be removed without weakening the talk, it is probably just decoration.",
        "Memorable speakers make the story carry argument, not merely mood."
      ),
      bullet(
        "Specific beats vague. One concrete person or moment is usually more persuasive than a broad general claim.",
        "Specificity gives the audience something to picture and emotionally track.",
        "This is why short personal stories or precise examples often land harder than sweeping summaries.",
        "A single vivid case can open the door for the wider pattern that follows."
      ),
      bullet(
        "Keep the story tight. Extra backstory weakens the point if it delays the reason you are telling it.",
        "A strong story moves quickly to the tension and the lesson.",
        "Listeners do not need every detail from your life. They need the details that make the meaning visible.",
        "Compression is part of good storytelling, not a betrayal of it."
      ),
      bullet(
        "Choose the right kind of story. Personal stories, stories about others, and stories about organizations each build connection in different ways.",
        "Different topics call for different narrative distance.",
        "A personal story can create intimacy, another person's story can widen perspective, and a company story can carry mission or culture.",
        "The choice should follow the message you want the audience to feel and remember."
      ),
      bullet(
        "Let conflict do the work. A story becomes interesting when something important is at stake.",
        "Without tension, the story is just chronology.",
        "The audience leans in when they can sense a problem, a decision, a risk, or a turning point.",
        "Conflict is what makes the lesson feel earned instead of announced."
      ),
      bullet(
        "Tie the lesson back clearly. After the story, show the audience exactly what they should notice or conclude.",
        "Do not assume the meaning will always transfer on its own.",
        "A brief bridge from story to idea helps the room carry the lesson into the rest of the talk.",
        "The story lands best when the speaker names why it mattered at that moment in the argument."
      ),
      bullet(
        "Emotion helps memory. When listeners feel something during a story, the idea attached to it becomes easier to recall.",
        "Feeling is not a substitute for thinking. It is often the glue that helps the thinking stay.",
        "Stories work so well because they unite logic with emotional movement instead of asking the audience to process only abstract claims.",
        "That is why good stories often outlast more detailed explanations in memory."
      ),
      bullet(
        "Honest stories beat polished fiction. Real experience usually carries more trust than manufactured drama.",
        "Audiences can often sense when a story exists only because the speaker wanted a dramatic moment.",
        "Authenticity matters here as much as anywhere else in the book.",
        "Truthful stories do not need exaggeration to matter if the stakes are chosen well."
      ),
      bullet(
        "A good story turns information into transfer. The audience can imagine using the lesson because they have already seen it happen in a human situation.",
        "That is why storytelling is not fluff. It helps ideas travel beyond the room.",
        "When people can replay the story later, they often replay the lesson with it.",
        "That makes story one of the strongest tools for practical speaking."
      ),
    ],
    deeperBullets: [
      bullet(
        "Stories lower defensiveness. People often accept a concrete human example before they accept a direct argument.",
        "A narrative can open attention in places where abstract persuasion would meet resistance."
      ),
      bullet(
        "Compression matters as much as content. A short story with one clean turn often lands better than a long one with several half turns.",
        "The tighter the arc, the easier it is for the audience to remember why you told it."
      ),
      bullet(
        "Detail should reveal meaning. The best details are the ones that make the tension visible, not the ones that merely prove you remember more.",
        "Good storytelling is selective. Detail serves insight."
      ),
      bullet(
        "A story can become the talk's backbone. In strong talks, the narrative arc often shapes the order of the ideas around it.",
        "When that happens well, the audience experiences the logic instead of only hearing it explained."
      ),
      bullet(
        "The audience should finish the story smarter. If the story is memorable but the point stays blurry, the speaker has entertained without teaching.",
        "The final test is not whether the room enjoyed the story. It is whether the story made the idea easier to carry forward."
      ),
    ],
    takeaways: [
      "Stories give ideas human shape",
      "Specific scenes beat broad claims",
      "Conflict creates interest",
      "Good stories stay tight",
      "The lesson must be named clearly",
      "Stories improve memory and transfer",
    ],
    practice: [
      "Choose one short story that proves the point",
      "Cut backstory that does not raise the stakes",
      "Name the lesson right after the story",
      "Test whether the story still works in under one minute",
    ],
    examples: [
      example(
        "ch02-ex01",
        "History comes alive",
        ["school"],
        "A student is presenting on the civil rights movement with dates, laws, and quotes, but the class is drifting. The material is important, yet it feels distant because nobody can picture a human life inside it.",
        [
          "Replace the overview opening with one short story about a person living through the event.",
          "Use the broader facts after the class understands what was at stake for that person."
        ],
        "The hidden issue is not lack of content. It is lack of human sequence. A story turns a pile of facts into a pattern the class can feel and remember."
      ),
      example(
        "ch02-ex02",
        "Club recruitment pitch",
        ["school"],
        "A student leader is recruiting volunteers for a tutoring club and leads with duties, hours, and scheduling needs. The room nods politely but does not commit.",
        [
          "Start with a brief story about one student who benefited from the club.",
          "Then show how that story connects to the roles you need filled."
        ],
        "A human example helps people understand what the work actually means. The request becomes concrete instead of administrative."
      ),
      example(
        "ch02-ex03",
        "Sales deck with no human face",
        ["work"],
        "A sales team presents a strong analytics deck, but the buyer hears only percentages and feature tables. The actual customer pain never feels real.",
        [
          "Tell one client story that shows the problem before you show the data.",
          "Use the metrics after the room can picture the human cost of doing nothing."
        ],
        "The story gives the numbers a job. Instead of floating as proof by themselves, they now deepen a situation the buyer already understands."
      ),
      example(
        "ch02-ex04",
        "Safety training nobody feels",
        ["work"],
        "A manager is leading a safety refresher after a near miss, but the talk opens with policy language. Employees know the rules already and tune out.",
        [
          "Open with the recent incident in a respectful, specific narrative.",
          "Then connect the policy reminders to the decisions people faced inside that moment."
        ],
        "Stories sharpen attention because they show consequence in sequence. The training stops feeling like repeated policy and starts feeling like lived judgment."
      ),
      example(
        "ch02-ex05",
        "Family donation request",
        ["personal"],
        "Someone wants relatives to support a local food bank and starts with annual totals and budget gaps. The numbers are real, but the appeal feels abstract.",
        [
          "Tell a short real story that shows the need instead of leading with totals.",
          "Use the numbers after the family can picture who the help is for."
        ],
        "People often act more readily once the issue has a human face. The story gives meaning to the numbers instead of asking the numbers to do everything."
      ),
      example(
        "ch02-ex06",
        "Roommate reset",
        ["personal"],
        "A roommate wants to fix an uneven chore split and plans to lecture with a list of complaints. The facts are solid, but the talk may sound like prosecution.",
        [
          "Use one recent scene that captures the problem everyone already recognizes.",
          "Then move from that scene to a simpler shared plan."
        ],
        "A concrete scene lowers abstraction and helps the other person see the issue instead of defending against a long argument."
      ),
    ],
    directQuestions: [
      question(
        "ch02-q01",
        "What makes a story most persuasive in a talk?",
        [
          "It gives the audience a human sequence with real stakes",
          "It adds length so the talk feels fuller",
          "It proves the speaker is creative",
          "It hides the need for a clear main point"
        ],
        0,
        "Stories work when they let the audience follow a person, a tension, and a change that reveals the idea."
      ),
      question(
        "ch02-q02",
        "A speaker tells a long amusing story and the room enjoys it, but the main message fades. What went wrong?",
        [
          "The story was not clearly tied back to the core idea",
          "The story used emotion at all",
          "The room laughed too much",
          "The speaker mentioned another person"
        ],
        0,
        "A story should serve the message. If the meaning does not return clearly, the audience remembers the moment but not the lesson."
      ),
      question(
        "ch02-q03",
        "When choosing how to open a talk, which option usually creates stronger audience connection?",
        [
          "A specific case that shows the problem before the larger pattern is explained",
          "A broad statement that summarizes every angle at once",
          "A dense block of background history",
          "A disclaimer about how complex the topic is"
        ],
        0,
        "Specific human examples help listeners care and orient faster than wide abstract framing."
      ),
      question(
        "ch02-q04",
        "Why do stories improve transfer after the talk ends?",
        [
          "They give people a situation they can replay when applying the lesson later",
          "They remove the need for evidence",
          "They make every talk shorter",
          "They guarantee the audience will agree"
        ],
        0,
        "A strong story becomes a mental model the listener can carry into later decisions, which is why it supports practical use."
      ),
    ],
  }),
  chapter({
    chapterId: "ch03-conversation-tone",
    number: 3,
    title: "Talk Like A Person Not A Script",
    readingTimeMinutes: 12,
    summary: {
      p1: t(
        "Natural delivery sounds conversational because the speaker has prepared deeply enough to stop clinging to a script.",
        "Gallo argues that great presenters rehearse obsessively, but the goal of that rehearsal is freedom, not robotic perfection.",
        "The audience should feel like the speaker is thinking with them in real time even when the talk has been carefully built."
      ),
      p2: t(
        "This matters because scripted delivery creates distance. People trust a speaker more when the message feels shared rather than recited.",
        "In practical terms, that means rehearsing ideas, transitions, and timing until you can keep eye contact, vary emphasis, and respond to the room.",
        "The deeper lesson is that authenticity is often trained. Preparation removes friction so presence can show up under pressure."
      ),
    },
    standardBullets: [
      bullet(
        "Rehearse to internalize, not to recite. Practice should make the structure second nature.",
        "When the talk lives in your head as a sequence of ideas, you can speak naturally without losing your place.",
        "This is different from memorizing exact sentences, which can make the speaker brittle.",
        "Internalization gives you the freedom that audiences experience as presence."
      ),
      bullet(
        "Conversation builds trust. People listen more openly when the speaker sounds like a real person rather than a recorded statement.",
        "Natural cadence, direct language, and room awareness help reduce distance.",
        "The talk still needs structure, but it should feel like thought shared aloud rather than text delivered from memory.",
        "Human delivery makes expertise easier to receive."
      ),
      bullet(
        "Memorize the flow, not every word. Knowing the sequence gives you freedom to speak naturally.",
        "A clear path lets you adapt your phrasing without losing the logic of the talk.",
        "That flexibility becomes especially important when the audience reacts in an unexpected way.",
        "You want to sound prepared, not trapped."
      ),
      bullet(
        "Script dependence breaks presence. When you cling to exact wording, small disruptions can knock you off balance.",
        "A missed line or a lost place feels larger when the talk is built like a recital.",
        "The room often senses that tension even if the words themselves are correct.",
        "Strong presenters reduce this risk by owning the ideas more than the sentences."
      ),
      bullet(
        "Eye contact and vocal variety matter. Natural delivery uses emphasis, pace, and pauses to keep the room with you.",
        "Conversation is not just word choice. It is also how your attention reaches the audience.",
        "Variation helps listeners follow the emotional and logical shape of the talk.",
        "A flat voice can make a strong idea sound smaller than it is."
      ),
      bullet(
        "Speaker notes should anchor, not imprison. Use prompts that help you remember direction without forcing you to read.",
        "Short cues keep the talk moving while leaving room for genuine phrasing.",
        "Heavy notes pull attention away from the room and back toward the page.",
        "A useful note reminds you where to go next, not what every sentence must be."
      ),
      bullet(
        "Practice out loud and on your feet. The body remembers a talk differently when you rehearse it under realistic conditions.",
        "Speaking silently in your head hides pacing problems, awkward transitions, and breath issues.",
        "Physical rehearsal makes the live version feel more familiar and less fragile.",
        "Good preparation treats delivery as a full body act, not a text exercise."
      ),
      bullet(
        "Record, review, refine. Listening back helps you hear stiffness that feels normal while you are speaking.",
        "A recording reveals whether you sound like a person talking or a person reciting.",
        "This feedback loop is one of the fastest ways to improve natural delivery.",
        "The camera often catches what confidence hides from the speaker."
      ),
      bullet(
        "Room awareness beats perfect wording. A talk improves when you can notice confusion, interest, or resistance and respond.",
        "That responsiveness is only possible when you are not consumed by remembering lines.",
        "Listeners feel more respected when the speaker is clearly present with them.",
        "Conversation means staying in contact, not just staying on script."
      ),
      bullet(
        "Preparation is what makes spontaneity believable. The more work you do beforehand, the more human you can sound in the moment.",
        "This is one of the book's most useful paradoxes.",
        "Natural delivery is usually built, not born.",
        "The goal is a talk that feels alive because the structure is strong enough to disappear."
      ),
    ],
    deeperBullets: [
      bullet(
        "Natural delivery includes discipline. Casual sounding talks are usually highly structured under the surface.",
        "Ease onstage is often the visible result of hidden rigor."
      ),
      bullet(
        "Over memorization shifts attention inward. You start monitoring your lines instead of serving the listener.",
        "That inward focus makes connection harder even when the script is remembered correctly."
      ),
      bullet(
        "Transitions deserve extra practice. Weak handoffs make a talk feel scripted even if individual lines sound fine.",
        "Smooth movement between ideas is one of the clearest markers of confident speaking."
      ),
      bullet(
        "A conversational talk can still be precise. Warmth is not the same as looseness or rambling.",
        "The best speakers sound human while staying exact about meaning."
      ),
      bullet(
        "Presence is a competitive advantage. When the room feels you are fully there, trust and recall rise together.",
        "In crowded environments, real presence is often what separates a strong message from a forgettable one."
      ),
    ],
    takeaways: [
      "Rehearse until the flow feels natural",
      "Conversation increases trust",
      "Memorize sequence more than sentences",
      "Use notes as cues not script",
      "Practice aloud under realistic conditions",
      "Presence is built through preparation",
    ],
    practice: [
      "Rehearse the main ideas without reading",
      "Practice transitions until they sound smooth",
      "Record one full run and mark stiff moments",
      "Use a cue card with prompts not paragraphs",
    ],
    examples: [
      example(
        "ch03-ex01",
        "Speech that freezes on one lost line",
        ["school"],
        "A student memorized every sentence of a class speech. When a classmate laughs unexpectedly, she loses one line and the rest of the talk unravels.",
        [
          "Rehearse the sequence of ideas until you can speak without exact wording.",
          "Then practice recovering from small interruptions on purpose."
        ],
        "The real weakness is not nerves. It is dependence on fixed language. Internalized structure makes a speaker more resilient and more natural."
      ),
      example(
        "ch03-ex02",
        "Group presentation from the slides",
        ["school"],
        "A student team built strong slides but reads them nearly word for word during a group presentation. The room stops looking up because everyone can already see the text.",
        [
          "Turn the slides into prompts and practice speaking beyond them.",
          "Use eye contact and transitions to make the presentation feel shared instead of read."
        ],
        "When the speaker reads what the audience can already see, connection disappears. Conversational delivery gives the talk a reason to exist in the room."
      ),
      example(
        "ch03-ex03",
        "Investor pitch from memory",
        ["work"],
        "A founder rehearsed a funding pitch so rigidly that every answer sounds like a memorized paragraph. Investors start wondering whether she can think flexibly under pressure.",
        [
          "Internalize the logic of the pitch so you can answer in your own words.",
          "Practice with interruptions so the delivery stays steady when the room shifts."
        ],
        "A scripted sound can signal fragility. Strong preparation should make the speaker more adaptive, not less."
      ),
      example(
        "ch03-ex04",
        "Client briefing with buried eyes",
        ["work"],
        "An analyst knows the material but keeps looking down at printed notes during a client briefing. The content is correct, yet the room feels disconnected from him.",
        [
          "Reduce the notes to short cues that free you to look at the client.",
          "Practice the talk standing up until the flow feels familiar without reading."
        ],
        "The audience judges presence as well as content. Notes should support attention, not steal it."
      ),
      example(
        "ch03-ex05",
        "Toast from a phone screen",
        ["personal"],
        "A friend reads a birthday toast from a phone because she is scared of forgetting anything. The words are kind, but the delivery feels distant.",
        [
          "Memorize the key beats and speak them in your own voice.",
          "Keep only a few rescue notes in case you need a quick glance."
        ],
        "Even personal moments can lose warmth when the speaker treats them like text to be recited. A little structure and a little freedom usually land better."
      ),
      example(
        "ch03-ex06",
        "Workshop leader who sounds rehearsed",
        ["personal"],
        "Someone is leading a community workshop and has clearly practiced, but the opening sounds so polished that participants hesitate to interact. The room feels like an audience instead of a group conversation.",
        [
          "Keep the structure but loosen the wording so the opening sounds spoken not performed.",
          "Build in one or two natural questions that bring the room into the talk early."
        ],
        "Good speaking is not cold precision. It is prepared clarity that still leaves room for human exchange."
      ),
    ],
    directQuestions: [
      question(
        "ch03-q01",
        "What most often creates natural sounding delivery?",
        [
          "Internalized structure built through real rehearsal",
          "Memorizing every sentence perfectly",
          "Using longer notes",
          "Speaking faster so mistakes are less noticeable"
        ],
        0,
        "The book's point is that practice should free the speaker from rigid wording, not trap the speaker inside it."
      ),
      question(
        "ch03-q02",
        "A talk sounds stiff even though the content is strong. What is the strongest fix?",
        [
          "Practice speaking the ideas aloud without clinging to exact sentences",
          "Add more formal vocabulary",
          "Turn every slide into a full script",
          "Remove all pauses so the pace feels smoother"
        ],
        0,
        "Natural delivery improves when the speaker owns the ideas deeply enough to phrase them in a living voice."
      ),
      question(
        "ch03-q03",
        "Why can memorizing every word backfire?",
        [
          "It makes the speaker brittle and inwardly focused",
          "It makes the talk too short",
          "It removes the need for rehearsal",
          "It guarantees the audience will not ask questions"
        ],
        0,
        "Exact wording can feel safe, but it often steals attention from the room and makes recovery harder when something shifts."
      ),
      question(
        "ch03-q04",
        "Which preparation choice best supports spontaneous presence?",
        [
          "Rehearsing openings, transitions, and key beats until you can adapt the wording",
          "Waiting until the last minute so the talk feels fresh",
          "Writing a longer manuscript for accuracy",
          "Using the slides as the main source of language"
        ],
        0,
        "The most believable spontaneity comes from deep familiarity with the talk's structure, not from lack of practice."
      ),
    ],
  }),
  chapter({
    chapterId: "ch04-teach-something-new",
    number: 4,
    title: "Novelty Wins Attention",
    readingTimeMinutes: 13,
    summary: {
      p1: t(
        "Novelty wins attention when it teaches the audience something surprising and meaningful.",
        "Gallo shows that the brain perks up when expectations are broken, but the surprise has to serve understanding.",
        "A fresh fact, angle, or demonstration is powerful because it interrupts passive listening and makes the audience ask what comes next."
      ),
      p2: t(
        "This matters because people tune out what feels predictable. New information reopens attention and makes the speaker worth listening to.",
        "In real settings, that means looking for what is unexpected, counterintuitive, or newly relevant about your topic and then explaining why it matters fast.",
        "The deeper lesson is that novelty is a doorway, not the destination. The surprise earns attention so the idea can do real work."
      ),
    },
    standardBullets: [
      bullet(
        "Surprise resets attention. A fresh insight wakes people up faster than a familiar summary.",
        "When the audience realizes it may learn something it did not already know, listening quality changes.",
        "That shift is one reason TED talks often open with a striking fact or reframed question.",
        "Novelty breaks passive listening and creates anticipation."
      ),
      bullet(
        "New must still matter. Novelty works only when the audience quickly sees why the information matters.",
        "Random surprise can create a moment, but meaningful surprise creates engagement.",
        "The best unexpected facts or angles change how the listener sees the subject.",
        "A room keeps listening when the new information feels useful, not merely odd."
      ),
      bullet(
        "Lead with the unexpected angle. Put the most surprising relevant fact or claim near the start.",
        "Early novelty tells the audience the talk may reward their attention.",
        "That does not mean giving away everything at once. It means opening a strong curiosity loop.",
        "A predictable opening often loses energy before the talk can fully begin."
      ),
      bullet(
        "Counterintuitive beats obvious. People lean in when the talk challenges an assumption they were carrying.",
        "A familiar topic becomes interesting again when the speaker exposes what most people have missed.",
        "This is especially useful with subjects the audience thinks it already understands.",
        "Strong speakers do not just repeat accepted wisdom. They sharpen it or overturn it."
      ),
      bullet(
        "One sharp insight beats a pile of trivia. Too many surprising facts can blur the main point.",
        "Novelty should serve the argument, not replace it.",
        "A single memorable insight often gives the talk a cleaner spine than several disconnected surprises.",
        "The audience needs something surprising that can also organize the rest of the message."
      ),
      bullet(
        "Explain the surprise clearly. After the audience reacts, guide them to the meaning instead of letting the moment hang.",
        "Surprise creates attention, but explanation creates understanding.",
        "Without the bridge back to meaning, the room remembers the fact and misses the lesson.",
        "The strongest speakers move quickly from what is unexpected to why it matters."
      ),
      bullet(
        "Research for what the room has not heard before. Novelty often comes from knowing the audience's default view and deliberately moving past it.",
        "What feels fresh depends on what the audience expects.",
        "The same talk can sound obvious to one room and exciting to another if the starting assumptions differ.",
        "This makes audience awareness part of finding novelty."
      ),
      bullet(
        "Make the insight usable. Surprise lands best when listeners can connect it to a decision, a habit, or a new way of seeing.",
        "Novel information is memorable, but practical novelty is far more valuable.",
        "The room should leave not just amused but mentally rearranged.",
        "Useful novelty keeps working after the talk ends."
      ),
      bullet(
        "Do not confuse shock with value. Empty sensationalism may grab attention briefly, but it does not build trust.",
        "The audience can feel when a speaker is reaching for reaction rather than meaning.",
        "A dramatic number or claim needs honest context if it is going to strengthen the talk.",
        "Credibility grows when surprise and substance arrive together."
      ),
      bullet(
        "Useful novelty makes the speaker memorable. People remember talks that taught them something they want to repeat later.",
        "A new idea often becomes the line the audience shares with others after the event.",
        "That repeatability is one reason novelty matters so much in public speaking.",
        "If the room can retell the insight, the talk keeps traveling."
      ),
    ],
    deeperBullets: [
      bullet(
        "Novelty creates anticipation. Once the audience realizes the talk may change what it knows, it listens differently.",
        "Expectation itself becomes a source of attention."
      ),
      bullet(
        "Familiar topics still allow surprise. Often the fresh angle comes from local data, a concrete comparison, or a hidden consequence.",
        "You do not need a strange topic to teach something new. You need a sharper frame."
      ),
      bullet(
        "The room needs time to absorb the new idea. A strong speaker pauses and simplifies after the surprise instead of piling on more.",
        "Novelty can overwhelm if it arrives faster than understanding."
      ),
      bullet(
        "Novelty can reposition expertise. Teaching one unexpected truth can establish credibility faster than listing credentials.",
        "The audience often trusts the speaker more once it experiences a real gain in understanding."
      ),
      bullet(
        "A memorable talk often turns on one fresh frame. The insight becomes the hook people carry into later conversations.",
        "The deeper win is not just attention in the room. It is a new lens that survives outside it."
      ),
    ],
    takeaways: [
      "Surprise resets attention",
      "Novelty must be relevant",
      "One strong insight beats many weak ones",
      "Explain why the surprise matters",
      "Audience expectations shape what feels new",
      "Useful novelty travels after the talk",
    ],
    practice: [
      "Find one fact or angle the room will not expect",
      "Explain the meaning right after the surprise",
      "Cut novelty that does not support the message",
      "Test whether the insight changes how someone sees the topic",
    ],
    examples: [
      example(
        "ch04-ex01",
        "Biology class wake up",
        ["school"],
        "A student opens a presentation on sleep with textbook definitions and familiar health advice. Classmates tune out because they feel they already know the topic.",
        [
          "Lead with the unexpected finding that most changes how your class sees sleep.",
          "Then explain why that finding matters for everyday choices students actually make."
        ],
        "The problem is not the subject. It is the predictable entry. A relevant surprise reopens attention and makes the room willing to hear the rest."
      ),
      example(
        "ch04-ex02",
        "Recycling pitch on autopilot",
        ["school"],
        "A student club wants more volunteers for a recycling drive and keeps repeating broad climate language. Other students agree in theory but ignore the sign up form.",
        [
          "Use one surprising local number that shows the campus problem is bigger than people assume.",
          "Connect that surprise directly to the action you want students to take."
        ],
        "A fresh insight makes a familiar topic feel urgent again. It gives the audience a reason to update its mental picture."
      ),
      example(
        "ch04-ex03",
        "Cybersecurity briefing blur",
        ["work"],
        "An operations lead is briefing the company on password security and begins with standard warnings everyone has heard for years. Attention drops before the key risks appear.",
        [
          "Open with one unexpected pattern from your own company data.",
          "Use that pattern to show why the usual assumptions are no longer safe."
        ],
        "Novelty works best when it is close to the audience's reality. A local surprise feels harder to dismiss than a generic warning."
      ),
      example(
        "ch04-ex04",
        "Onboarding session nobody remembers",
        ["work"],
        "A manager is introducing new hires to the business and starts with org charts and process steps. The information is useful, but it feels like every other orientation.",
        [
          "Begin with one counterintuitive truth about how the business really works.",
          "Then use the rest of the session to explain the system behind that insight."
        ],
        "A fresh frame gives ordinary information a reason to matter. Instead of drowning in procedures, the audience now has a question worth following."
      ),
      example(
        "ch04-ex05",
        "Budget talk at home",
        ["personal"],
        "Someone wants to discuss household spending but opens with general advice about saving money. Family members nod and keep scrolling.",
        [
          "Start with one surprising number that changes how the spending pattern looks.",
          "Translate that number into a concrete consequence the household actually cares about."
        ],
        "A relevant surprise cuts through routine. It turns a familiar lecture into new information the room has to process."
      ),
      example(
        "ch04-ex06",
        "Volunteer appeal that sounds familiar",
        ["personal"],
        "A community organizer is asking neighbors to support a food pantry and repeats the same need based language everyone hears every year. People sympathize but do not move.",
        [
          "Lead with an unexpected fact that reveals the scale or shape of the need in your own area.",
          "Use that fresh insight to make the request feel immediate and specific."
        ],
        "People often need a new angle before they give old attention. Novelty changes the subject from routine need to updated reality."
      ),
    ],
    directQuestions: [
      question(
        "ch04-q01",
        "What kind of surprise helps a talk most?",
        [
          "A surprising point that quickly changes how the audience sees the subject",
          "A random fact with strong shock value",
          "A joke that has nothing to do with the topic",
          "A long list of unfamiliar terms"
        ],
        0,
        "Novelty is strongest when it is both unexpected and meaningful enough to redirect attention toward the idea."
      ),
      question(
        "ch04-q02",
        "A presenter opens with a bizarre statistic that gets a reaction but has little connection to the rest of the talk. What is the main problem?",
        [
          "The surprise creates noise without useful meaning",
          "The audience should never be surprised",
          "Statistics are weaker than stories in every situation",
          "The presenter should have spoken longer before sharing data"
        ],
        0,
        "Shock without relevance may win a moment of attention, but it does not build understanding or trust."
      ),
      question(
        "ch04-q03",
        "If a topic already feels familiar to the audience, what is the strongest way to create novelty?",
        [
          "Find a local or counterintuitive insight that changes the audience's assumptions",
          "Pretend the audience knows nothing",
          "Add more background definitions",
          "Avoid taking a clear angle until the end"
        ],
        0,
        "A familiar topic becomes fresh when the speaker finds the part that the room has not yet seen clearly."
      ),
      question(
        "ch04-q04",
        "Why should a speaker explain the surprise quickly after presenting it?",
        [
          "So the new information turns into understanding instead of remaining a loose fact",
          "So the audience forgets the surprise faster",
          "So the speaker can move on to a different topic",
          "So the room stops asking questions"
        ],
        0,
        "Surprise opens attention, but explanation converts that attention into a usable insight."
      ),
    ],
  }),
  chapter({
    chapterId: "ch05-wow-moments",
    number: 5,
    title: "Create Moments People Cannot Forget",
    readingTimeMinutes: 13,
    summary: {
      p1: t(
        "Memorable talks create one or more moments that people can see, feel, or retell later.",
        "Gallo describes these as jaw dropping moments, but the real point is not spectacle for its own sake. It is designing a demonstration or reveal that makes the idea unforgettable.",
        "A striking moment works when it turns the message from something merely heard into something experienced."
      ),
      p2: t(
        "This matters because audiences forget most details soon after a talk, but they often remember the moment that embodied the point.",
        "In practice, that means choosing a visual comparison, live demo, prop, or emotional reveal that serves the central idea and then building the rest of the talk around it.",
        "The deeper lesson is that memory is selective. If you do not design a memorable anchor, the audience may leave with scattered impressions instead of the one thing you most wanted them to keep."
      ),
    },
    standardBullets: [
      bullet(
        "Design one anchor moment. A talk becomes easier to remember when one scene or demonstration carries the message.",
        "People rarely retain every detail, so a memorable talk gives memory a clear handle.",
        "That anchor can be visual, emotional, physical, or surprising as long as it points back to the central idea.",
        "The room should be able to retell the moment and the lesson together."
      ),
      bullet(
        "Make the invisible visible. Great moments turn an abstract idea into something the room can literally picture or witness.",
        "A strong demonstration does in seconds what explanation may take minutes to accomplish.",
        "This is why props, comparisons, and live examples can be so powerful when used well.",
        "The audience believes faster when it can see the point taking shape."
      ),
      bullet(
        "Link the moment to the main claim. The impressive part should clarify the idea, not compete with it.",
        "Memorable is not the same as useful.",
        "A flashy reveal that does not strengthen the message may earn applause while weakening understanding.",
        "The best moments feel inevitable once the idea is clear."
      ),
      bullet(
        "Props work when they simplify. A physical object can compress explanation faster than another minute of words.",
        "Concrete objects help the audience feel scale, weight, difference, or consequence.",
        "The prop should remove friction, not create a side show that requires its own explanation.",
        "Simple objects often outperform elaborate ones for this reason."
      ),
      bullet(
        "Emotion strengthens recall. A moment that creates surprise, empathy, awe, or tension tends to stay with the audience longer.",
        "Memory is selective, and feeling helps decide what the mind keeps.",
        "A designed emotional beat can make the lesson feel worth holding onto.",
        "The strongest talks give people something to remember with both mind and feeling."
      ),
      bullet(
        "Less spectacle can be better. One precise reveal often lands harder than several smaller stunts.",
        "Too many wow attempts divide attention and make none of them feel central.",
        "A single clean moment usually gives the talk more shape and dignity.",
        "Memorability rises when the speaker chooses where the peak belongs."
      ),
      bullet(
        "Rehearse the moment carefully. Memorable moments feel effortless onstage because the logistics were handled before the room arrived.",
        "A prop, live demo, or timed reveal should be practiced at the same level as the spoken content.",
        "The more precise the moment, the more important its preparation becomes.",
        "Good execution protects the audience from confusion and protects the speaker from preventable chaos."
      ),
      bullet(
        "Use risk wisely. Live demonstrations can be powerful, but they should be safe, stable, and clearly tied to the message.",
        "A failing demo can sometimes be recovered, but reckless planning is not a sign of boldness.",
        "The goal is not to show courage. It is to give the audience a vivid lesson they can trust.",
        "Memorability does not excuse sloppiness."
      ),
      bullet(
        "Build toward the reveal. A memorable moment gets stronger when the audience understands what it is about to see and why it matters.",
        "Context creates anticipation and helps the reveal land cleanly.",
        "If the audience does not know what to look for, the moment can pass too quickly.",
        "Framing is part of the design, not a minor extra."
      ),
      bullet(
        "The right moment becomes the takeaway. People often retell the demonstration first and the principle right after it.",
        "That repeatability is a major speaking advantage.",
        "When the memorable beat and the core idea are fused, the talk keeps spreading after the event.",
        "A designed moment is one of the strongest ways to make an idea portable."
      ),
    ],
    deeperBullets: [
      bullet(
        "A strong reveal changes scale. It helps the audience feel size, speed, pain, or possibility in human terms.",
        "Moments are powerful because they turn measurement into experience."
      ),
      bullet(
        "Physical memory helps verbal memory. When the room sees or feels something concrete, later recall becomes easier.",
        "The mind often keeps the image and pulls the explanation back with it."
      ),
      bullet(
        "Moments can be quiet as well as dramatic. Sometimes a single image, silence, or comparison lands harder than motion.",
        "Memorability depends on fit, not only intensity."
      ),
      bullet(
        "A designed moment disciplines the rest of the talk. Once you know the anchor, you can cut material that does not support it.",
        "The moment becomes a structural tool as well as a memory tool."
      ),
      bullet(
        "Memorability is a service, not vanity. The goal is to help the audience keep the lesson after you are gone.",
        "When speakers chase reaction without meaning, they miss the real point of a wow moment."
      ),
    ],
    takeaways: [
      "Give the talk one memorable anchor",
      "Make abstract ideas concrete",
      "A prop should clarify not distract",
      "Emotion helps recall",
      "One strong reveal beats many weak ones",
      "Memorability should serve meaning",
    ],
    practice: [
      "Choose one moment that embodies the core idea",
      "Use a prop only if it simplifies the message",
      "Rehearse the reveal exactly",
      "Cut any dramatic move that does not deepen understanding",
    ],
    examples: [
      example(
        "ch05-ex01",
        "Murky water sample",
        ["school"],
        "A student is presenting on local river pollution with charts and definitions, but classmates are only half engaged. The problem feels distant because nobody can see what the data means in real life.",
        [
          "Bring one safe visual object that makes the hidden problem concrete.",
          "Use the object as the anchor before you explain the measurements behind it."
        ],
        "A visible moment collapses abstraction. Once the class can see the issue, the numbers have somewhere meaningful to land."
      ),
      example(
        "ch05-ex02",
        "Censorship on the page",
        ["school"],
        "A student is speaking about censorship in literature and has prepared a thoughtful analysis, but the talk feels academic and distant. The audience understands the thesis and still forgets it minutes later.",
        [
          "Create one visual reveal that lets the class feel what censorship removes.",
          "Build the rest of the explanation around that reveal so the image carries the argument."
        ],
        "A well chosen moment can make a familiar idea emotionally immediate. It gives memory something concrete to keep."
      ),
      example(
        "ch05-ex03",
        "Before and after demo",
        ["work"],
        "A product team is launching a new feature that cuts setup time, but the presenter relies on screenshots and estimates. The value sounds nice but not urgent.",
        [
          "Show one live comparison that makes the time difference impossible to miss.",
          "Then connect the demonstration to the business outcome it creates."
        ],
        "Seeing the change happen is far more memorable than hearing a claim about it. A concrete moment lets the room feel the gain."
      ),
      example(
        "ch05-ex04",
        "Backpack at the donor meeting",
        ["work"],
        "A nonprofit leader is asking for support for a student meal program and plans to speak only through budget tables. Donors may understand the need intellectually without truly feeling it.",
        [
          "Use one physical object or comparison that represents the problem in human terms.",
          "Tie the ask directly to that moment so the room remembers the need through an image."
        ],
        "People retain a clear embodied moment longer than a page of figures. The right reveal gives the appeal a lasting center."
      ),
      example(
        "ch05-ex05",
        "Receipt bowl on the table",
        ["personal"],
        "Someone wants the household to see how small daily purchases add up, but every prior money talk has drifted into debate and forgotten numbers.",
        [
          "Create one visible comparison that lets everyone feel the monthly total at once.",
          "Use that moment to move quickly into the simpler habit change you want."
        ],
        "A designed moment can stop an issue from remaining vague. The room sees the pattern before it has time to argue in the abstract."
      ),
      example(
        "ch05-ex06",
        "Cleanup bag at the block meeting",
        ["personal"],
        "A neighborhood organizer wants more volunteers for a cleanup day, but the problem has become background scenery and people no longer notice it.",
        [
          "Bring one striking visual that shows the scale of the problem immediately.",
          "Let that visual carry the urgency before you explain the volunteer plan."
        ],
        "When people can see the issue in one memorable beat, the request feels more real and more worth repeating to others."
      ),
    ],
    directQuestions: [
      question(
        "ch05-q01",
        "What makes a memorable moment useful in a talk?",
        [
          "It embodies the main idea instead of distracting from it",
          "It proves the speaker is bold enough to take risks",
          "It takes more time than explanation would",
          "It works even if the audience misses the meaning"
        ],
        0,
        "The best reveal or demonstration is not impressive by itself. It becomes memorable because it clarifies the message."
      ),
      question(
        "ch05-q02",
        "When is a prop worth using?",
        [
          "When it makes an abstract claim easier to grasp immediately",
          "When the speaker wants extra stage activity",
          "When the talk feels too short",
          "When the audience seems hard to impress"
        ],
        0,
        "A prop earns its place when it simplifies the idea and gives the audience a concrete experience of it."
      ),
      question(
        "ch05-q03",
        "What is the biggest mistake a speaker can make with a wow moment?",
        [
          "Creating spectacle that competes with the message",
          "Practicing the moment in advance",
          "Using only one reveal",
          "Explaining what the audience is seeing"
        ],
        0,
        "A memorable beat should support the idea. If it becomes its own separate show, recall may rise while understanding falls."
      ),
      question(
        "ch05-q04",
        "Why can one strong reveal outperform several smaller dramatic moves?",
        [
          "Memory organizes more easily around one clear anchor",
          "Audiences only enjoy one emotional moment",
          "Speakers should avoid all variation",
          "A single reveal removes the need for evidence"
        ],
        0,
        "One central moment gives the talk shape and helps the audience keep the lesson attached to a single vivid memory."
      ),
    ],
  }),
  chapter({
    chapterId: "ch06-humor-and-lightness",
    number: 6,
    title: "Use Humor To Increase Warmth",
    readingTimeMinutes: 11,
    summary: {
      p1: t(
        "Humor makes speakers feel human, which lowers distance and helps the audience relax into the talk.",
        "Gallo does not treat humor as a stand up routine. He treats it as a way to create warmth, ease, and likability without losing the message.",
        "The right laugh signals that the speaker is comfortable, self aware, and safe to listen to."
      ),
      p2: t(
        "This matters because tension and stiffness make even good material harder to receive.",
        "In real life, that means using humor that fits your personality, respects the audience, and supports the talk rather than hijacking it.",
        "The deeper lesson is that warmth increases persuasion. People are more receptive when they feel the speaker is not hiding behind formality or trying to dominate the room."
      ),
    },
    standardBullets: [
      bullet(
        "Humor reduces distance. A well timed laugh helps the room feel closer to the speaker.",
        "Warmth changes how people receive the rest of the talk.",
        "A lighter moment can make authority feel more human instead of weaker.",
        "The audience often becomes more open once the speaker stops sounding guarded."
      ),
      bullet(
        "Use humor that sounds like you. The best humor fits your personality instead of imitating someone else's style.",
        "A joke that works for one speaker may sound forced coming from another.",
        "This is why self knowledge matters so much with humor.",
        "Authentic lightness builds trust faster than borrowed wit."
      ),
      bullet(
        "Self aware humor is often safest. Lightly laughing at your own situation usually lands better than aiming the joke at others.",
        "It shows confidence without creating a target in the room.",
        "That kind of humor can lower tension while keeping goodwill intact.",
        "Safe humor often works because it signals ease rather than superiority."
      ),
      bullet(
        "Warmth matters more than punch lines. A talk can benefit from lightness even if you are not naturally funny.",
        "Not every speaker needs jokes. Some only need a relaxed, human touch.",
        "A smile, an honest observation, or a gentle bit of self awareness can be enough.",
        "The real aim is receptiveness, not comedy."
      ),
      bullet(
        "Keep the joke tied to the moment. Humor works best when it grows out of the situation or the story you are already telling.",
        "Contextual humor feels more natural and less pasted on.",
        "The audience can sense when a line belongs in the room and when it was carried in from somewhere else.",
        "Natural fit is what keeps humor from feeling like a gimmick."
      ),
      bullet(
        "Never let humor blur the point. If the audience remembers the joke but not the idea, the balance was wrong.",
        "Humor is there to help the message land, not replace it.",
        "A speaker should know exactly what the laugh is doing for the talk.",
        "The stronger the message, the easier it is to keep humor in proportion."
      ),
      bullet(
        "Respect the room. Humor that embarrasses, excludes, or punches down damages trust fast.",
        "A laugh won at someone else's expense usually costs more than it gives.",
        "This is especially important when the speaker already holds status or authority.",
        "Warmth disappears the moment humor feels unsafe."
      ),
      bullet(
        "Timing beats quantity. One or two natural moments of levity usually work better than repeated attempts.",
        "The audience does not need constant laughs to feel relaxed.",
        "Too many jokes can make the talk feel effortful or insecure.",
        "A small amount of well placed lightness often changes the room more than a stream of attempts."
      ),
      bullet(
        "Serious topics still allow humanity. Lightness can create breathing room without trivializing the subject.",
        "The key is fit and proportion.",
        "A warm line can help the room stay open long enough to hear difficult material.",
        "Humor is most useful here when it releases tension rather than denying reality."
      ),
      bullet(
        "Humor is a relationship tool. It tells the audience that the speaker is confident enough to be real.",
        "That social effect is often more important than the laugh itself.",
        "People tend to trust speakers who feel comfortable in their own skin.",
        "Used well, humor helps authority feel accessible instead of distant."
      ),
    ],
    deeperBullets: [
      bullet(
        "Laughter can reset attention. A warm funny moment clears tension and gives the next idea a cleaner landing.",
        "Humor can act like a mental reset when the room is stiff or overloaded."
      ),
      bullet(
        "Forced humor exposes insecurity. People can feel when the speaker wants approval more than connection.",
        "That is why canned jokes often land worse than simple human warmth."
      ),
      bullet(
        "Delivery matters as much as the line. Pace, pause, and facial expression often determine whether a moment feels natural.",
        "Humor is rarely only about wording. It is about timing and presence too."
      ),
      bullet(
        "Not every speaker needs the same level of humor. Some win with wit, some with warmth, and some with a single understated line.",
        "The right amount is the amount that fits the speaker and serves the message."
      ),
      bullet(
        "The underlying goal is ease. When the room relaxes, more of the talk can get through.",
        "Humor matters because it improves reception, not because every speaker needs to become entertaining."
      ),
    ],
    takeaways: [
      "Humor lowers distance",
      "Authentic lightness beats borrowed jokes",
      "Self aware humor is often safest",
      "Warmth matters more than punch lines",
      "Respect the room",
      "Humor should support the message",
    ],
    practice: [
      "Use one light line that sounds natural to you",
      "Cut jokes that target the audience",
      "Place humor near a tense or formal moment",
      "Check that the point still matters after the laugh",
    ],
    examples: [
      example(
        "ch06-ex01",
        "Nervous class opening",
        ["school"],
        "A student is opening a class presentation and sounds so tense that classmates brace themselves too. She has good material, but the stiffness is making the room work harder than necessary.",
        [
          "Use one light self aware line that fits your actual personality.",
          "Then move quickly into the substance before the humor turns into a separate performance."
        ],
        "The goal is not to become a comedian. It is to lower tension and let the room meet a person instead of a nervous script."
      ),
      example(
        "ch06-ex02",
        "Orientation leader too formal",
        ["school"],
        "A student leader is welcoming new members and sounds like he is reading policy aloud. The group listens politely but stays stiff and quiet.",
        [
          "Make one playful observation that belongs naturally to the moment.",
          "Use that brief laugh to create ease before you give the important information."
        ],
        "A little warmth can open the room without reducing clarity. When people relax, they listen more readily."
      ),
      example(
        "ch06-ex03",
        "Kickoff after a rough release",
        ["work"],
        "A team is starting a project right after a stressful product issue. The manager wants to reset the room, but everyone still feels guarded.",
        [
          "Open with a gentle line that acknowledges the shared reality without mocking it.",
          "Then pivot into the plan while the room is more relaxed and available."
        ],
        "Humor works best here as pressure release. It lets the team breathe without pretending the stress never happened."
      ),
      example(
        "ch06-ex04",
        "Canned joke in the demo",
        ["work"],
        "A sales presenter keeps forcing polished jokes into a product demo, and the room looks uncertain because the humor does not fit her style. The product itself is strong, but trust is slipping.",
        [
          "Cut the canned joke and use one natural line that sounds like you.",
          "Let the product and your ease do most of the work after that."
        ],
        "Forced humor draws attention to performance anxiety. Natural lightness builds warmth without making the audience manage your act."
      ),
      example(
        "ch06-ex05",
        "Birthday toast drifting toward roast",
        ["personal"],
        "Someone is giving a birthday toast and plans to rely on sharp teasing because silence feels risky. A few of the jokes may get laughs, but they may also make the guest of honor tense.",
        [
          "Choose affection over sharpness and keep any humor mostly on your own side.",
          "Use the laugh to make the room warmer, not to prove you are clever."
        ],
        "Humor that creates safety strengthens connection. Humor that creates edge can make the moment smaller than it should be."
      ),
      example(
        "ch06-ex06",
        "Volunteer meetup in bad weather",
        ["personal"],
        "A neighborhood volunteer leader is addressing a soggy crowd after the event had to move indoors. Everyone is mildly frustrated and low energy.",
        [
          "Start with one light observation that everyone in the room already shares.",
          "Then move into the plan while the mood is looser and more cooperative."
        ],
        "Shared lightness can reset a room quickly when it grows naturally out of the moment. It reminds people they are with a human being, not a stiff announcement."
      ),
    ],
    directQuestions: [
      question(
        "ch06-q01",
        "What kind of humor usually helps a talk most?",
        [
          "Humor that feels authentic and respectful to the room",
          "The most aggressive joke that gets a quick laugh",
          "A memorized stand up routine",
          "Humor that distracts from serious points"
        ],
        0,
        "Humor helps when it creates warmth and ease without weakening trust or clarity."
      ),
      question(
        "ch06-q02",
        "A speaker is not naturally funny. What is the strongest approach?",
        [
          "Use light human warmth instead of forcing big jokes",
          "Avoid all warmth so the talk sounds serious",
          "Copy a funny speaker's exact rhythm",
          "Tell more jokes until one works"
        ],
        0,
        "The book does not require every speaker to become comedic. It asks speakers to become more human and approachable."
      ),
      question(
        "ch06-q03",
        "When should humor be cut from a talk?",
        [
          "When it undercuts trust, respect, or the central point",
          "When the audience is paying close attention",
          "When the speaker has practiced it",
          "When the topic includes any serious element"
        ],
        0,
        "Humor is useful only while it serves the message and keeps the relationship with the room strong."
      ),
      question(
        "ch06-q04",
        "What is the deeper value of humor in public speaking?",
        [
          "It lowers distance and makes the audience more receptive",
          "It replaces the need for preparation",
          "It guarantees likability no matter the message",
          "It works only if the whole talk is funny"
        ],
        0,
        "Humor matters because warmth changes how the audience receives the speaker and the idea."
      ),
    ],
  }),
  chapter({
    chapterId: "ch07-eighteen-minute-rule",
    number: 7,
    title: "Respect Attention Limits",
    readingTimeMinutes: 12,
    summary: {
      p1: t(
        "Great speakers respect the limits of attention, which is why they cut hard, simplify hard, and refuse to mistake length for value.",
        "Gallo uses the eighteen minute TED limit as a symbol of a larger principle: audiences can only hold so much before clarity drops.",
        "Constraint forces the speaker to choose what matters most and protect it from dilution."
      ),
      p2: t(
        "This matters because overloaded talks feel exhausting even when the topic is important.",
        "In practical terms, the lesson is to compress the message, break longer sessions into clear sections, and design with working memory in mind.",
        "The deeper lesson is that brevity is respect. Editing is not withholding value from the audience. It is shaping value so they can actually absorb it."
      ),
    },
    standardBullets: [
      bullet(
        "Attention is limited. Strong talks are built around what people can realistically hold in mind.",
        "The audience's ability to follow is not infinite, even when the topic is interesting.",
        "A speaker who ignores cognitive limits often mistakes overwhelm for thoroughness.",
        "Respect for attention is part of respect for the audience."
      ),
      bullet(
        "Time limits force clarity. A constraint exposes what belongs in the talk and what does not.",
        "When time is short, weak material can no longer hide behind abundance.",
        "This makes limits a creative and editorial advantage.",
        "The speaker discovers the real priority by deciding what survives."
      ),
      bullet(
        "One main line beats scattered coverage. Audiences remember a clear through line better than a long tour of loosely related points.",
        "A strong talk usually feels organized around one answer, one tension, or one idea worth carrying.",
        "Coverage without hierarchy often leaves the room with fragments instead of insight.",
        "Clarity grows when the speaker chooses a central path and stays on it."
      ),
      bullet(
        "Cutting is part of caring. Editing protects the strongest idea from being buried.",
        "Removing material is not an admission that the content is unimportant.",
        "It is often the only way to keep the most important part visible enough to matter.",
        "Good speakers make peace with subtraction."
      ),
      bullet(
        "Break long sessions into chunks. If you have more time, reset attention with sections, stories, or changes in pace.",
        "The principle is not about one magic number. It is about mental load.",
        "Longer talks can still respect attention if they create clear internal boundaries.",
        "The audience needs landmarks, not just minutes."
      ),
      bullet(
        "Slides should lighten load, not add more. Dense slides split attention and reduce comprehension.",
        "When people are reading and listening at the same time, both channels weaken.",
        "Strong visual support makes the spoken message easier to follow rather than harder.",
        "Simplicity on the screen is one way to respect the mind's bandwidth."
      ),
      bullet(
        "Shorter often feels smarter. Concision signals that the speaker understands the material well enough to prioritize.",
        "Rambling can sound less informed rather than more informed.",
        "A tight explanation suggests command because the speaker can distinguish core from excess.",
        "Editing often improves credibility as much as memory."
      ),
      bullet(
        "Repetition should reinforce, not pad. Return to the main idea on purpose instead of restating it because the talk is drifting.",
        "Intentional repetition strengthens recall, but accidental repetition signals weak structure.",
        "The room notices the difference quickly.",
        "A concise talk repeats with purpose and variation."
      ),
      bullet(
        "Respecting cognitive load improves follow through. People act on messages they can actually remember.",
        "A talk that leaves the audience tired often leaves it inactive too.",
        "Clarity and compression increase the chance that the idea survives after the event.",
        "Memorability depends partly on not making the room carry too much at once."
      ),
      bullet(
        "The real rule is disciplined compression. The number matters less than the principle behind it.",
        "The book's deeper claim is not that every good talk must last the same length.",
        "It is that every speaker should design with attention as a scarce resource.",
        "The best talks feel lean because they were edited to respect how people actually listen."
      ),
    ],
    deeperBullets: [
      bullet(
        "Brevity raises the cost of vagueness. When time is tight, fuzzy points become impossible to hide.",
        "Constraint rewards speakers who can name the point cleanly."
      ),
      bullet(
        "Long talks can still follow the rule. They just need clear internal chapters that give the audience mental rest.",
        "Attention limits do not disappear when the calendar block gets larger."
      ),
      bullet(
        "Too much content can signal insecurity. Some speakers overfill the talk because they do not trust one strong idea to carry enough weight.",
        "Editing often requires confidence in the value of the core message."
      ),
      bullet(
        "Constraint can make delivery stronger. With less to juggle, the speaker has more room for presence and emphasis.",
        "Compression helps the message and the performance at the same time."
      ),
      bullet(
        "Attention is a scarce resource. Speakers who waste less of it are remembered as clearer and more credible.",
        "That advantage compounds in school, work, and any setting where many voices compete for limited focus."
      ),
    ],
    takeaways: [
      "Attention is limited",
      "Time limits force prioritization",
      "One through line beats coverage",
      "Editing is part of caring",
      "Longer talks still need resets",
      "Compression improves follow through",
    ],
    practice: [
      "Cut to one main through line",
      "Remove slides that add reading load",
      "Break longer talks into clear sections",
      "Trim any point the audience can infer without you",
    ],
    examples: [
      example(
        "ch07-ex01",
        "Too many slides for class",
        ["school"],
        "A student group has twenty minutes to present and brings sixty crowded slides because they are afraid to leave anything out. By the middle, classmates stop tracking the argument.",
        [
          "Cut the talk to one through line and remove anything the room can infer without you.",
          "Use the freed time to make the surviving points clearer and easier to remember."
        ],
        "The real issue is not lack of effort. It is lack of prioritization. Editing protects the idea from drowning in its own material."
      ),
      example(
        "ch07-ex02",
        "Workshop that never resets",
        ["school"],
        "A student leader is running a forty minute study session and plans to lecture continuously because there is a lot to cover. People start fading even though the information matters.",
        [
          "Break the session into short sections with clear resets in attention.",
          "Use examples or brief questions to help each section land before moving on."
        ],
        "Longer time does not remove attention limits. It increases the need for structure that helps the mind start fresh."
      ),
      example(
        "ch07-ex03",
        "All hands overload",
        ["work"],
        "A manager wants to cover every initiative in a company all hands and builds a long deck that treats each topic as equally important. Employees leave unsure what actually matters most.",
        [
          "Choose one central message and make the rest of the talk serve it.",
          "Move lower priority details into follow up material instead of forcing them into the live moment."
        ],
        "A room can process only so much. When everything looks equally important, very little remains memorable."
      ),
      example(
        "ch07-ex04",
        "Training with crowded screens",
        ["work"],
        "A trainer fills each slide with text because she wants the information to be available later. During the session, people read ahead and stop listening.",
        [
          "Simplify the slides so they support listening instead of competing with it.",
          "Provide detailed reference material separately if people need it after the session."
        ],
        "The problem is split attention. Visual support should reduce mental load, not double it."
      ),
      example(
        "ch07-ex05",
        "Wedding toast that keeps growing",
        ["personal"],
        "Someone keeps adding stories to a wedding toast because every memory feels important. By the end, the emotion has diluted into repetition.",
        [
          "Keep one through line and cut stories that do not deepen it.",
          "Trust that one well chosen memory can honor the moment better than six scattered ones."
        ],
        "Length often weakens warmth by smearing it across too many moments. Compression helps the meaning stay strong."
      ),
      example(
        "ch07-ex06",
        "House rules lecture",
        ["personal"],
        "A parent wants to explain new house rules and turns the conversation into a long speech. Halfway through, nobody is really listening anymore.",
        [
          "Reduce the talk to the few rules that actually matter now.",
          "Deliver them in short sections so each point has room to register."
        ],
        "Attention is not won by force. Clear prioritization makes the message more likely to stick and be followed."
      ),
    ],
    directQuestions: [
      question(
        "ch07-q01",
        "What is the main purpose of the eighteen minute rule?",
        [
          "To respect attention limits and force stronger editing",
          "To make every talk feel identical",
          "To eliminate the need for detail",
          "To prove that longer talks are always bad"
        ],
        0,
        "The number stands for a larger principle. Strong speakers design with human attention and working memory in mind."
      ),
      question(
        "ch07-q02",
        "If a session must last much longer than eighteen minutes, what is the strongest way to apply the principle?",
        [
          "Chunk the session into clear sections that reset attention",
          "Speak faster so more content fits",
          "Add more slides so the audience stays busy",
          "Avoid repeating the main idea at all"
        ],
        0,
        "Longer formats still need cognitive relief. Clear internal structure helps the audience keep following."
      ),
      question(
        "ch07-q03",
        "What common mistake does this lesson push against?",
        [
          "Equating more material with more value",
          "Using any story in a presentation",
          "Practicing a talk in advance",
          "Opening with a clear claim"
        ],
        0,
        "The book argues that value often rises when the speaker subtracts noise and protects the main message."
      ),
      question(
        "ch07-q04",
        "Why does brevity often improve persuasion?",
        [
          "Because the main idea survives intact and becomes easier to remember",
          "Because short talks never need structure",
          "Because audiences prefer entertainment over thought",
          "Because any detail automatically weakens a message"
        ],
        0,
        "Compression helps the strongest idea stay visible long enough to matter, which is one reason concise talks often land harder."
      ),
    ],
  }),
  chapter({
    chapterId: "ch08-multisensory-language",
    number: 8,
    title: "Paint Pictures With Sensory Detail",
    readingTimeMinutes: 12,
    summary: {
      p1: t(
        "Vivid language helps people see the idea, and people remember what they can picture far better than what they only hear abstractly.",
        "Gallo emphasizes multisensory communication because strong talks do not live only in logic. They create mental images, sounds, texture, and movement.",
        "When the audience can almost experience the idea, understanding becomes faster and memory becomes stickier."
      ),
      p2: t(
        "This matters because abstraction is easy to lose. Sensory detail turns concepts into scenes the mind can hold.",
        "In practice, that means choosing concrete nouns, active verbs, comparisons, visuals, and examples that let listeners imagine what you mean.",
        "The deeper lesson is that communication is partly design for the imagination. The best speakers do not just describe an idea. They stage it inside the listener's mind."
      ),
    },
    standardBullets: [
      bullet(
        "Paint the scene. Concrete language helps the audience picture what you mean.",
        "A mental image gives the message something stable to attach to.",
        "When listeners can see the point, they do not have to work as hard to hold it.",
        "Strong speaking often sounds visual even before a slide appears."
      ),
      bullet(
        "Abstract ideas need embodiment. A concept becomes easier to grasp when it is tied to a visible moment or object.",
        "Words like growth, friction, trust, or burnout are clearer when the audience can imagine them in action.",
        "Concrete examples turn invisible claims into scenes the mind can simulate.",
        "Embodiment is often the bridge from comprehension to memory."
      ),
      bullet(
        "Use sensory detail with purpose. A few precise sights, sounds, textures, or movements go further than generic adjectives.",
        "Good detail sharpens the image instead of decorating it.",
        "The point is not to pile on description. It is to choose the detail that reveals the meaning fastest.",
        "Precision matters more than volume here."
      ),
      bullet(
        "Strong visuals support the words. Slides and images work best when they deepen the scene instead of repeating text.",
        "A visual should help the audience see more clearly, not read more heavily.",
        "When image and language reinforce each other, the point grows easier to feel and remember.",
        "Visual design becomes part of storytelling when it serves the scene."
      ),
      bullet(
        "Analogy can turn complexity simple. A familiar comparison helps the room feel the structure of a new idea.",
        "Good analogies borrow the audience's existing understanding instead of making everything start from zero.",
        "They are especially helpful when the topic is technical or abstract.",
        "An analogy works best when it carries both clarity and vividness."
      ),
      bullet(
        "Choose vivid verbs and nouns. Specific language carries more mental force than vague business phrasing.",
        "Listeners picture crack, drag, flood, pile, lock, and spill more easily than broad corporate labels.",
        "Concrete wording often sharpens both pace and meaning.",
        "A speaker who names the scene clearly gives the audience less abstract fog to fight through."
      ),
      bullet(
        "Do not overload the image. Too many details can blur the scene the audience is trying to build.",
        "One or two vivid cues are often enough.",
        "The mind needs clarity more than quantity when forming a picture.",
        "A selective image lands harder than a crowded one."
      ),
      bullet(
        "Sensory language improves memory. People recall talks better when they can replay a mental picture from them.",
        "The image becomes a retrieval path back to the message.",
        "That is why vivid speakers often sound memorable even when their wording is simple.",
        "A strong picture gives the audience a place to return."
      ),
      bullet(
        "Concrete wording increases emotional access. It is easier to care about what you can imagine happening.",
        "Abstraction can be true and still feel far away.",
        "Once the listener can picture the event, the stakes often feel more immediate.",
        "Imagination makes the topic easier to feel as well as understand."
      ),
      bullet(
        "Great speakers make ideas experiential. The goal is not just to define the point but to help the room feel it.",
        "A talk becomes stronger when the audience can almost step into the scene you are describing.",
        "That experiential quality is one reason vivid language travels so well beyond the event itself.",
        "People remember what they can mentally re live."
      ),
    ],
    deeperBullets: [
      bullet(
        "Mental imagery shortens explanation. One strong picture can replace several lines of abstraction.",
        "Vividness is often an efficiency tool as much as an artistic one."
      ),
      bullet(
        "Different senses can deepen the same idea. Sound, motion, or texture can make a point feel more alive than sight alone.",
        "Multisensory language expands the audience's internal experience of the message."
      ),
      bullet(
        "Imagery helps transfer. When people can simulate the situation, they can apply the lesson later with less effort.",
        "A picture in the mind becomes a usable template for future decisions."
      ),
      bullet(
        "Visual language disciplines jargon. It forces the speaker to say what the idea would actually look or feel like in life.",
        "That pressure often exposes weak thinking and improves clarity."
      ),
      bullet(
        "Concrete speech can still be sophisticated. Precision and vividness belong together.",
        "The strongest communicators often sound simple because their images are exact, not because their thinking is thin."
      ),
    ],
    takeaways: [
      "Concrete language is easier to picture",
      "Abstract ideas need scenes or objects",
      "Use a few precise sensory details",
      "Analogy can simplify complexity",
      "Vivid language improves memory",
      "Strong talks feel experiential",
    ],
    practice: [
      "Replace one abstract phrase with a scene",
      "Choose stronger nouns and verbs",
      "Use one analogy that the room already understands",
      "Cut decorative detail that does not sharpen the image",
    ],
    examples: [
      example(
        "ch08-ex01",
        "Erosion without a picture",
        ["school"],
        "A student is explaining soil erosion with correct terminology, but classmates cannot really imagine what the process looks like. The material feels remote and technical.",
        [
          "Replace the abstract explanation with a concrete scene the class can picture.",
          "Use the technical term only after the image has made the process visible."
        ],
        "The hidden problem is not accuracy. It is invisibility. Vivid language gives the mind something to hold before it has to process the formal concept."
      ),
      example(
        "ch08-ex02",
        "Poetry talk with no texture",
        ["school"],
        "A student says a poem creates tension and sadness, but the explanation stays at the level of labels. The class hears interpretation without ever feeling the scene.",
        [
          "Point to the sensory details that create the feeling in the poem.",
          "Use those details to make your interpretation feel lived instead of merely asserted."
        ],
        "Concrete details turn commentary into experience. The audience understands the claim faster once it can sense what the words are doing."
      ),
      example(
        "ch08-ex03",
        "App experience in abstractions",
        ["work"],
        "A designer says a new checkout flow will feel smoother and reduce friction, but stakeholders hear two abstract promises with no picture attached.",
        [
          "Describe what the user sees and feels step by step in one short scene.",
          "Then connect that scene to the performance numbers you want approved."
        ],
        "Sensory language makes design decisions easier to evaluate because it lets the room experience the change before seeing the metrics."
      ),
      example(
        "ch08-ex04",
        "Process change nobody can visualize",
        ["work"],
        "A manager wants her team to adopt a new workflow and keeps explaining it with abstract terms like visibility and alignment. People nod and still do not know what will actually change.",
        [
          "Use a concrete before and after scene that shows the old and new workflow in action.",
          "Choose words the team can picture instead of labels they have to decode."
        ],
        "The team needs a mental movie, not just a policy label. Once the process is visible, resistance often drops because confusion drops."
      ),
      example(
        "ch08-ex05",
        "Travel story with no scene",
        ["personal"],
        "Someone is telling friends about an important trip and keeps using words like amazing and beautiful. Everyone is being polite, but nobody can actually picture the place.",
        [
          "Use two or three precise sensory details that place the listener inside the moment.",
          "Let the details do the emotional work instead of stacking broad adjectives."
        ],
        "Specific images create presence. Generic praise leaves the listener outside the story."
      ),
      example(
        "ch08-ex06",
        "Future home conversation",
        ["personal"],
        "A couple is discussing a possible move and keeps speaking in broad terms about lifestyle and fit. The conversation stalls because neither person can imagine the same future.",
        [
          "Describe one ordinary day in the new place using concrete detail.",
          "Use that shared picture to evaluate whether the move truly fits."
        ],
        "Vivid language does not only make talks memorable. It can also make personal decisions clearer by giving people the same scene to think about."
      ),
    ],
    directQuestions: [
      question(
        "ch08-q01",
        "Why does concrete language usually beat abstract phrasing in a talk?",
        [
          "It is easier for the audience to picture and remember",
          "It removes the need for evidence",
          "It makes every subject informal",
          "It always shortens the talk"
        ],
        0,
        "Vivid language helps the audience build a mental image, and that image supports both understanding and recall."
      ),
      question(
        "ch08-q02",
        "Which line would be most memorable in a talk about a slow website?",
        [
          "Each click felt like standing at a stuck elevator waiting for the doors to open",
          "The platform showed significant delays in core navigation pathways",
          "The experience created performance challenges for end users",
          "The site had a problematic user journey in several areas"
        ],
        0,
        "The first line gives the audience a concrete feeling and image, which makes the problem easier to understand immediately."
      ),
      question(
        "ch08-q03",
        "What is a common mistake when trying to make language more vivid?",
        [
          "Piling on decorative detail that does not sharpen a clear scene",
          "Using an analogy that fits the idea",
          "Choosing stronger verbs",
          "Connecting an abstract point to a visible moment"
        ],
        0,
        "Vividness depends on precision, not on adding as many descriptive words as possible."
      ),
      question(
        "ch08-q04",
        "What is the deeper benefit of sensory detail in a talk?",
        [
          "It turns explanation into an experience the audience can mentally replay later",
          "It guarantees emotional agreement",
          "It replaces the need for structure",
          "It works only with highly visual topics"
        ],
        0,
        "The best sensory language helps the audience simulate the idea, which strengthens both memory and transfer."
      ),
    ],
  }),
  chapter({
    chapterId: "ch09-authentic-lane",
    number: 9,
    title: "Build On Your Own Strengths",
    readingTimeMinutes: 12,
    summary: {
      p1: t(
        "Great speakers build on their own strengths instead of copying someone else's persona.",
        "Gallo argues that the most memorable talks feel original because the speaker's delivery matches temperament, experience, and natural advantages.",
        "Technique still matters, but it should amplify what is already genuinely yours rather than bury it under imitation."
      ),
      p2: t(
        "This matters because borrowed style often sounds strained. People can feel when a speaker is wearing someone else's voice.",
        "In real life, the lesson is to study strong speakers for principles, then adapt those principles to your own pace, humor, stories, and presence.",
        "The deeper lesson is that authenticity is not passivity. It is strategic fit. When your method matches your strengths, confidence, consistency, and recall all improve."
      ),
    },
    standardBullets: [
      bullet(
        "Do not imitate the surface. Study great speakers for principles, not for their exact personality.",
        "You can borrow structure, rhythm, editing habits, or story techniques without copying someone else's outward style.",
        "Surface imitation often sounds thinner than the original because it is detached from the speaker's own nature.",
        "Learning works best when it becomes adaptation rather than costume."
      ),
      bullet(
        "Your natural strengths are part of the message. Calm authority, humor, deep expertise, warmth, and storytelling can all work if they are real.",
        "There is no single winning personality for public speaking.",
        "The book keeps reminding the reader that memorability can come through several different channels.",
        "Strong speakers discover which channel carries their message best."
      ),
      bullet(
        "Authenticity sounds easier to trust. Audiences relax when the speaker is not obviously performing a borrowed identity.",
        "Fit creates ease, and ease often reads as confidence.",
        "That does not mean every authentic habit is useful. It means the strongest style grows from what the speaker can sustain truthfully.",
        "People trust signals that align."
      ),
      bullet(
        "Use models as ingredients. Borrow structure, pacing, or technique without copying voice, gestures, or persona.",
        "A role model is a source of methods, not a template for self erasure.",
        "This mindset helps speakers learn aggressively while staying original.",
        "It also protects the talk from feeling like an imitation of someone the audience has already seen."
      ),
      bullet(
        "Strength based delivery is more sustainable. It is easier to rehearse and repeat a style that fits how you naturally communicate.",
        "A mismatched style costs energy every time you try to perform it.",
        "Fit matters not only in one talk but across many talks over time.",
        "What is sustainable often becomes what is memorable."
      ),
      bullet(
        "Weak imitation drains attention. The speaker spends energy acting instead of serving the idea.",
        "That strain can show up as odd pacing, exaggerated gestures, or a voice that never quite sounds settled.",
        "The audience may not name the problem precisely, but it often feels the mismatch.",
        "False style steals capacity that should belong to the message."
      ),
      bullet(
        "Authenticity does not excuse laziness. You still need editing, rehearsal, and discipline.",
        "Being yourself is not enough if the talk remains unclear or under prepared.",
        "The book's argument is about fit, not about rejecting craft.",
        "Your lane should be strengthened, not left untrained."
      ),
      bullet(
        "Different speakers win in different ways. Some are intense, some playful, some quiet, and some highly visual.",
        "This variety is one reason TED talks can feel so fresh across speakers.",
        "A memorable style does not come from one approved mold. It comes from using the right advantages well.",
        "Range in successful speaking is evidence against imitation."
      ),
      bullet(
        "Know what the room gets from you. Your best lane is the one where your distinct advantage is clearest.",
        "A speaker might be unusually good at simplifying, dramatizing, teaching, comforting, provoking thought, or clarifying complexity.",
        "Once you know the advantage, you can design talks that let it show.",
        "Strength becomes more valuable when it is recognized and deliberately used."
      ),
      bullet(
        "Memorable speaking is personal craft. The goal is not to sound like a TED speaker. It is to sound like the strongest version of yourself.",
        "That final lesson ties the book together.",
        "The book teaches techniques, but it never asks the reader to become generic.",
        "The strongest speaker is usually the one whose craft and identity are working in the same direction."
      ),
    ],
    deeperBullets: [
      bullet(
        "Style should fit content too. The right lane depends not only on personality but on what the idea needs.",
        "A speaker may have several strengths, but each talk still needs the version that best serves the message."
      ),
      bullet(
        "Self knowledge speeds improvement. Once you know your strengths, you can practice more precisely.",
        "You stop wasting energy trying to become every kind of speaker at once."
      ),
      bullet(
        "Originality often comes from emphasis, not invention. Small truthful differences in rhythm, examples, and tone can make a talk feel distinctly yours.",
        "You do not need to be eccentric to be memorable. You need coherence."
      ),
      bullet(
        "Confidence grows when style and self align. You speak with less friction when you stop managing a false persona.",
        "That reduced friction can make delivery calmer, clearer, and more persuasive."
      ),
      bullet(
        "The final lesson ties the book together. Great speaking is learnable craft shaped through human individuality, not a fixed mold.",
        "The book ends by protecting the reader from a common mistake, which is learning techniques only to erase the self that should use them."
      ),
    ],
    takeaways: [
      "Study principles not persona",
      "Different strengths can win",
      "Authenticity improves trust",
      "Fit is more sustainable than imitation",
      "Craft still matters",
      "The best style is the strongest version of you",
    ],
    practice: [
      "Name the speaking strengths you already carry",
      "Borrow one principle without copying delivery style",
      "Design the talk around your clearest advantage",
      "Cut gestures or phrasing that feel borrowed",
    ],
    examples: [
      example(
        "ch09-ex01",
        "Quiet student copying a captain",
        ["school"],
        "A student preparing for a competition tries to imitate the loudest and most theatrical speaker on the team. The copied style makes him tense and less clear than usual.",
        [
          "Build the talk around calm clarity and the strengths you can deliver honestly.",
          "Borrow the structure you admire without copying the personality wrapped around it."
        ],
        "The problem is not low energy. It is poor fit. A style that matches the speaker is easier to trust and easier to sustain under pressure."
      ),
      example(
        "ch09-ex02",
        "Artist forcing formal delivery",
        ["school"],
        "A creative student gives strong explanations in conversation but turns stiff and over formal during presentations because she thinks that is what serious speakers sound like.",
        [
          "Use the visual and expressive strengths you naturally bring to explanation.",
          "Keep the rigor of the content while letting the delivery sound more like your real thinking voice."
        ],
        "Authenticity is not the enemy of seriousness. When style and person align, the message often becomes clearer and more memorable."
      ),
      example(
        "ch09-ex03",
        "Technical founder playing entertainer",
        ["work"],
        "A founder keeps forcing big stage energy into investor updates because he thinks that is what strong presenters do. The performance distracts from the sharp product insight he actually brings.",
        [
          "Lean into the clarity, precision, and demonstrations that are naturally your strength.",
          "Use energy to support that strength instead of trying to replace it with borrowed showmanship."
        ],
        "Memorability does not require imitation. The strongest lane is the one where your real advantage becomes easiest for the room to notice."
      ),
      example(
        "ch09-ex04",
        "Manager mimicking a keynote style",
        ["work"],
        "A manager who is excellent one on one starts copying a famous keynote speaker's gestures and catchphrases for town halls. Employees notice the performance before they notice the message.",
        [
          "Adapt the strengths people already trust in you to the larger room.",
          "Borrow techniques that fit your voice instead of importing someone else's persona."
        ],
        "A borrowed shell often hides the quality the audience actually values. Fit makes leadership communication easier to believe."
      ),
      example(
        "ch09-ex05",
        "Speech borrowed from the internet",
        ["personal"],
        "Someone writing a wedding speech keeps copying the rhythm of viral toasts online and ends up sounding unlike herself. The lines are polished, but the emotion feels second hand.",
        [
          "Use your own tone and memories even if the language is simpler.",
          "Keep only the techniques that help your real voice come through more clearly."
        ],
        "People remember sincerity more than borrowed brilliance. The speech should sound like the person giving it, not like an algorithm of good speeches."
      ),
      example(
        "ch09-ex06",
        "Community leader using influencer voice",
        ["personal"],
        "A neighborhood organizer starts speaking in a highly branded social media tone because it seems more charismatic. Longtime volunteers feel the shift immediately and pull back.",
        [
          "Return to the grounded style that matches how people already trust you.",
          "Add stronger structure and clearer calls to action without adopting a false persona."
        ],
        "Authenticity is strategic because it protects trust. A style that feels borrowed can cost credibility even if it sounds energetic."
      ),
    ],
    directQuestions: [
      question(
        "ch09-q01",
        "What does staying in your lane actually mean for a speaker?",
        [
          "Building on your genuine strengths instead of copying someone else's persona",
          "Avoiding any feedback from strong speakers",
          "Refusing to improve weak areas",
          "Keeping every talk informal"
        ],
        0,
        "The book's final lesson is about fit. Strong speakers learn from others without erasing themselves."
      ),
      question(
        "ch09-q02",
        "What is the best use of role models in public speaking?",
        [
          "Borrow their principles and adapt them to your own style",
          "Copy their gestures and timing exactly",
          "Use their stories instead of your own",
          "Ignore your natural strengths so you can sound bigger"
        ],
        0,
        "Role models are sources of method, not blueprints for imitation."
      ),
      question(
        "ch09-q03",
        "A naturally quiet speaker worries that she is not dynamic enough. What is the strongest move?",
        [
          "Lean into calm authority and sharpen the strengths that already fit her",
          "Force louder energy in every sentence",
          "Memorize another speaker's delivery pattern",
          "Use humor constantly to hide the discomfort"
        ],
        0,
        "Different kinds of presence can work. The key is to amplify real strength instead of performing borrowed intensity."
      ),
      question(
        "ch09-q04",
        "Why can authenticity be a strategic advantage rather than just a moral preference?",
        [
          "Because fit improves confidence, consistency, and trust",
          "Because it removes the need for practice",
          "Because audiences only like informal speakers",
          "Because it guarantees originality in every line"
        ],
        0,
        "When style matches the speaker, delivery becomes easier to sustain and easier for the audience to believe."
      ),
    ],
  }),
];

function buildScenarioQuestions(chapterNumber, examples) {
  return examples.map((ex, index) => {
    const correct = ex.whatToDo[0];
    const wrongIndexes = [
      (chapterNumber + index) % SCENARIO_WRONG_BANK.length,
      (chapterNumber + index + 2) % SCENARIO_WRONG_BANK.length,
      (chapterNumber + index + 5) % SCENARIO_WRONG_BANK.length,
    ];

    const choices = [
      correct,
      SCENARIO_WRONG_BANK[wrongIndexes[0]],
      SCENARIO_WRONG_BANK[wrongIndexes[1]],
      SCENARIO_WRONG_BANK[wrongIndexes[2]],
    ];

    return question(
      `ch${String(chapterNumber).padStart(2, "0")}-sq${index + 1}`,
      `${ex.scenario} What is the strongest next step?`,
      choices,
      0,
      ex.whyItMatters
    );
  });
}

function chapter({
  chapterId,
  number,
  title,
  readingTimeMinutes,
  simpleIndexes = DEFAULT_SIMPLE_INDEXES,
  summary,
  standardBullets,
  deeperBullets,
  takeaways,
  practice,
  examples,
  directQuestions,
}) {
  const easyBullets = simpleIndexes.map((index) => standardBullets[index]);
  const hardBullets = [...standardBullets, ...deeperBullets];
  const scenarioQuestions = buildScenarioQuestions(number, examples);
  const questions = [...directQuestions, ...scenarioQuestions];

  if (easyBullets.length !== 7) {
    throw new Error(`Chapter ${number} must have 7 simple bullets.`);
  }
  if (standardBullets.length !== 10) {
    throw new Error(`Chapter ${number} must have 10 standard bullets.`);
  }
  if (hardBullets.length !== 15) {
    throw new Error(`Chapter ${number} must have 15 deeper bullets.`);
  }
  if (examples.length !== 6) {
    throw new Error(`Chapter ${number} must have 6 examples.`);
  }
  if (questions.length !== 10) {
    throw new Error(`Chapter ${number} must have 10 questions.`);
  }

  return {
    chapterId,
    number,
    title,
    readingTimeMinutes,
    contentVariants: Object.fromEntries(
      ["easy", "medium", "hard"].map((level) => {
        const paragraphOne = compose(summary.p1, level);
        const paragraphTwo = compose(summary.p2, level);
        const levelBullets =
          level === "easy" ? easyBullets : level === "medium" ? standardBullets : hardBullets;

        return [
          level,
          {
            importantSummary: `${paragraphOne} ${paragraphTwo}`.trim(),
            summaryBullets: levelBullets.map((item) => item.text),
            takeaways,
            practice,
            summaryBlocks: [
              { type: "paragraph", text: paragraphOne },
              { type: "paragraph", text: paragraphTwo },
              ...levelBullets.map((item) => ({
                type: "bullet",
                text: item.text,
                detail: compose(item.detail, level),
              })),
            ],
          },
        ];
      })
    ),
    examples,
    quiz: {
      passingScorePercent: 80,
      questions,
    },
  };
}

function clean(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

function sentence(value) {
  const text = clean(value);
  if (!text) return "";
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function renderBullet(block) {
  return `${block.text} ${block.detail}`.trim();
}

function reportBook(bookPackage) {
  const chapters = [...bookPackage.chapters].sort((left, right) => left.number - right.number);
  const lines = [];

  lines.push("# 1. Book audit summary for Talk Like TED by Carmine Gallo", "");
  AUDIT_SUMMARY.forEach((paragraph) => lines.push(sentence(paragraph), ""));

  lines.push("# 2. Main content problems found", "");
  MAIN_PROBLEMS.forEach((paragraph, index) => lines.push(`${index + 1}. ${sentence(paragraph)}`));
  lines.push("");

  lines.push("# 3. Personalization strategy for Talk Like TED by Carmine Gallo", "");
  PERSONALIZATION_STRATEGY.forEach((paragraph) => lines.push(sentence(paragraph), ""));

  lines.push("# 4. Any minimal schema adjustments needed", "", sentence(SCHEMA_NOTE), "");

  lines.push("# 5. Chapter by chapter revised content", "");

  chapters.forEach((chapterItem) => {
    const simple = chapterItem.contentVariants.easy;
    const standard = chapterItem.contentVariants.medium;
    const deeper = chapterItem.contentVariants.hard;
    const simpleBullets = simple.summaryBlocks.filter((block) => block.type === "bullet");
    const standardBullets = standard.summaryBlocks.filter((block) => block.type === "bullet");
    const deeperBullets = deeper.summaryBlocks.filter((block) => block.type === "bullet");

    lines.push(`## ${chapterItem.number}. ${chapterItem.title}`, "");
    lines.push("### Summary", "");
    lines.push("#### Simple", "");
    simple.summaryBlocks
      .filter((block) => block.type === "paragraph")
      .forEach((block, index) => lines.push(`${index + 1}. ${sentence(block.text)}`));
    lines.push("");
    lines.push("#### Standard", "");
    standard.summaryBlocks
      .filter((block) => block.type === "paragraph")
      .forEach((block, index) => lines.push(`${index + 1}. ${sentence(block.text)}`));
    lines.push("");
    lines.push("#### Deeper", "");
    deeper.summaryBlocks
      .filter((block) => block.type === "paragraph")
      .forEach((block, index) => lines.push(`${index + 1}. ${sentence(block.text)}`));
    lines.push("");

    lines.push("### Bullet points", "");
    lines.push("#### Simple", "");
    simpleBullets.forEach((block, index) => lines.push(`${index + 1}. ${sentence(renderBullet(block))}`));
    lines.push("");
    lines.push("#### Standard", "");
    standardBullets.forEach((block, index) =>
      lines.push(`${index + 1}. ${sentence(renderBullet(block))}`)
    );
    lines.push("");
    lines.push("#### Deeper", "");
    deeperBullets.forEach((block, index) =>
      lines.push(`${index + 1}. ${sentence(renderBullet(block))}`)
    );
    lines.push("");

    lines.push("### Scenarios", "");
    chapterItem.examples.forEach((exampleItem, index) => {
      const scope = (exampleItem.contexts?.[0] || "personal").toUpperCase();
      lines.push(`${index + 1}. ${exampleItem.title} (${scope})`);
      lines.push(`Scenario: ${sentence(exampleItem.scenario)}`);
      lines.push(`What to do: ${exampleItem.whatToDo.map((step) => sentence(step)).join(" ")}`);
      lines.push(`Why it matters: ${sentence(exampleItem.whyItMatters)}`);
      lines.push("");
    });

    lines.push("### Quiz", "");
    chapterItem.quiz.questions.forEach((questionItem, index) => {
      const correctIndex = questionItem.correctAnswerIndex ?? questionItem.correctIndex ?? 0;
      lines.push(`${index + 1}. ${sentence(questionItem.prompt)}`);
      questionItem.choices.forEach((choice, choiceIndex) => {
        lines.push(`${String.fromCharCode(65 + choiceIndex)}. ${sentence(choice)}`);
      });
      lines.push(`Correct answer: ${String.fromCharCode(65 + correctIndex)}`);
      lines.push(`Explanation: ${sentence(questionItem.explanation || "")}`);
      lines.push("");
    });
  });

  lines.push("# 6. Final quality control summary", "");
  lines.push("1. Every chapter now has exactly two summary paragraphs in each depth variant.");
  lines.push("2. Every chapter now has seven Simple bullets, ten Standard bullets, and fifteen Deeper bullets.");
  lines.push("3. Every chapter has six scenarios with two school, two work, and two personal examples.");
  lines.push("4. Every chapter now has ten quiz questions built around applied understanding and realistic distractors.");
  lines.push("5. The package remains schema compatible while the reader can apply Talk Like TED specific motivation guidance.");
  lines.push("6. The resulting book now reads as a cohesive lesson sequence rather than a generic template.");
  lines.push("");

  return lines.join("\n");
}

function assertNoDashContent(bookPackage) {
  const violations = [];

  for (const chapterItem of bookPackage.chapters) {
    for (const variant of Object.values(chapterItem.contentVariants)) {
      for (const block of variant.summaryBlocks || []) {
        if (/[–—-]/.test(block.text)) violations.push(`chapter ${chapterItem.number} block text`);
        if (block.type === "bullet" && block.detail && /[–—-]/.test(block.detail)) {
          violations.push(`chapter ${chapterItem.number} block detail`);
        }
      }
      for (const item of variant.takeaways || []) {
        if (/[–—-]/.test(item)) violations.push(`chapter ${chapterItem.number} takeaway`);
      }
      for (const item of variant.practice || []) {
        if (/[–—-]/.test(item)) violations.push(`chapter ${chapterItem.number} practice`);
      }
    }

    for (const exampleItem of chapterItem.examples) {
      if (/[–—-]/.test(exampleItem.title)) violations.push(`chapter ${chapterItem.number} example title`);
      if (/[–—-]/.test(exampleItem.scenario)) violations.push(`chapter ${chapterItem.number} example scenario`);
      if (/[–—-]/.test(exampleItem.whyItMatters)) violations.push(`chapter ${chapterItem.number} example why`);
      for (const step of exampleItem.whatToDo) {
        if (/[–—-]/.test(step)) violations.push(`chapter ${chapterItem.number} example step`);
      }
    }

    for (const questionItem of chapterItem.quiz.questions || []) {
      if (/[–—-]/.test(questionItem.prompt)) violations.push(`chapter ${chapterItem.number} quiz prompt`);
      if (questionItem.explanation && /[–—-]/.test(questionItem.explanation)) {
        violations.push(`chapter ${chapterItem.number} quiz explanation`);
      }
      if (/\bthis chapter\b|\bthe chapter\b|\bthis reading\b|\bthe reading\b/i.test(questionItem.prompt)) {
        violations.push(`chapter ${chapterItem.number} banned quiz prompt phrasing`);
      }
      for (const choice of questionItem.choices || []) {
        if (/[–—-]/.test(choice)) violations.push(`chapter ${chapterItem.number} quiz choice`);
      }
    }
  }

  if (violations.length) {
    throw new Error(`Dash or phrasing violation found: ${violations[0]}`);
  }
}

function verifyExamples(examples, chapterNumber) {
  const counts = { school: 0, work: 0, personal: 0 };
  for (const ex of examples) {
    const scope = ex.contexts?.[0];
    if (scope !== "school" && scope !== "work" && scope !== "personal") {
      throw new Error(`Chapter ${chapterNumber} has invalid example context.`);
    }
    counts[scope] += 1;
  }
  if (counts.school !== 2 || counts.work !== 2 || counts.personal !== 2) {
    throw new Error(`Chapter ${chapterNumber} must have 2 school, 2 work, and 2 personal examples.`);
  }
}

function buildPackage() {
  const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
  const chapterMap = new Map(CHAPTER_REVISIONS.map((item) => [item.number, item]));

  pkg.createdAt = new Date().toISOString();
  pkg.packageId = randomUUID();
  pkg.chapters = pkg.chapters.map((chapterItem) => {
    const revised = chapterMap.get(chapterItem.number);
    if (!revised) {
      throw new Error(`Missing revision for chapter ${chapterItem.number}`);
    }
    verifyExamples(revised.examples, chapterItem.number);
    return revised;
  });

  assertNoDashContent(pkg);

  writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + "\n");
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, reportBook(pkg));
  console.log(`Updated ${packagePath}`);
  console.log(`Wrote ${reportPath}`);
}

buildPackage();
