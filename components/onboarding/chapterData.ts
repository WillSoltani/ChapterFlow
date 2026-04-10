// ─────────────────────────────────────────
// Chapter content + shelf books per choice
// ─────────────────────────────────────────

export type PersonalizationChoice = "work" | "thinking" | "habits" | "growth";

export interface ChapterContentItem {
  bookTitle: string;
  author: string;
  chapter: string;
  coverGradient: string;
  summary: {
    mainIdea: string;
    keyTakeaway: string;
  };
  scenario: {
    prompt: string;
    optionA: { text: string; isCorrect: boolean };
    optionB: { text: string; isCorrect: boolean };
    correctFeedback: string;
    wrongFeedback: string;
  };
  quiz: {
    question: string;
    options: { letter: string; text: string; isCorrect: boolean }[];
  };
}

export interface ShelfBook {
  title: string;
  author: string;
  category: string;
  gradient: string;
}

export const chapterContent: Record<PersonalizationChoice, ChapterContentItem> =
  {
    work: {
      bookTitle: "Deep Work",
      author: "Cal Newport",
      chapter: "Chapter 1",
      coverGradient: "linear-gradient(135deg, #2563EB, #1D4ED8)",
      summary: {
        mainIdea:
          "The ability to perform deep work is becoming increasingly rare at the same time it is becoming increasingly valuable. Those who cultivate this skill will thrive.",
        keyTakeaway:
          "Deep work — focused, uninterrupted concentration on cognitively demanding tasks — produces results that shallow, distracted work cannot replicate.",
      },
      scenario: {
        prompt:
          "Alex has a critical report due Friday. His calendar is packed with meetings, Slack pings constantly, and he keeps checking email. Based on this chapter, what should Alex do?",
        optionA: {
          text: "Schedule the meetings closer together to batch them and work in between",
          isCorrect: false,
        },
        optionB: {
          text: "Block 3 distraction-free hours, close Slack and email, and focus only on the report",
          isCorrect: true,
        },
        correctFeedback:
          "That's it. Deep work requires eliminating distraction, not just managing it.",
        wrongFeedback:
          "Close — but batching meetings still leaves shallow gaps. The chapter says to create distraction-free blocks.",
      },
      quiz: {
        question:
          "According to Chapter 1, why is deep work becoming more valuable?",
        options: [
          {
            letter: "A",
            text: "Technology makes it easier to focus",
            isCorrect: false,
          },
          {
            letter: "B",
            text: "It is rare, and rare skills are valuable",
            isCorrect: true,
          },
          {
            letter: "C",
            text: "Employers now require it in job descriptions",
            isCorrect: false,
          },
          {
            letter: "D",
            text: "Shallow work has been automated away",
            isCorrect: false,
          },
        ],
      },
    },

    thinking: {
      bookTitle: "Thinking, Fast and Slow",
      author: "Daniel Kahneman",
      chapter: "Chapter 1",
      coverGradient: "linear-gradient(135deg, #0D9488, #0F766E)",
      summary: {
        mainIdea:
          "Your brain operates with two systems: System 1 is fast, automatic, and intuitive. System 2 is slow, deliberate, and logical. Most errors come from relying on System 1 when System 2 is needed.",
        keyTakeaway:
          "Recognizing which system is driving your thinking is the first step to making better decisions.",
      },
      scenario: {
        prompt:
          "A product costs $1.10 total. The product costs $1.00 more than the case. Jordan instantly answers 'the case costs 10 cents.' Is Jordan right?",
        optionA: {
          text: "Yes — $1.10 minus $1.00 is $0.10",
          isCorrect: false,
        },
        optionB: {
          text: "No — the case actually costs 5 cents ($0.05 + $1.05 = $1.10)",
          isCorrect: true,
        },
        correctFeedback:
          "Exactly. System 1 jumps to 10 cents, but System 2 catches the real math.",
        wrongFeedback:
          "That's the System 1 trap. If the case is $0.10, the product is $1.10, making the total $1.20. The case is actually $0.05.",
      },
      quiz: {
        question:
          "What is the key difference between System 1 and System 2?",
        options: [
          {
            letter: "A",
            text: "System 1 is emotional, System 2 is rational",
            isCorrect: false,
          },
          {
            letter: "B",
            text: "System 1 is fast and automatic, System 2 is slow and deliberate",
            isCorrect: true,
          },
          {
            letter: "C",
            text: "System 1 handles memory, System 2 handles perception",
            isCorrect: false,
          },
          {
            letter: "D",
            text: "They work together on every decision equally",
            isCorrect: false,
          },
        ],
      },
    },

    habits: {
      bookTitle: "The Power of Habit",
      author: "Charles Duhigg",
      chapter: "Chapter 1",
      coverGradient: "linear-gradient(135deg, #D4A574, #C4956A)",
      summary: {
        mainIdea:
          "Habits follow a loop: cue, routine, reward. Lasting change becomes easier when you identify the loop and redesign the routine instead of relying on willpower alone.",
        keyTakeaway:
          "If you can see the cue and reward clearly, you can swap in a better routine and make the behavior easier to repeat.",
      },
      scenario: {
        prompt:
          "Marcus automatically grabs chips every afternoon when work gets stressful. Based on this chapter's idea, what should he do first?",
        optionA: {
          text: "Set a stricter rule and hope willpower is stronger tomorrow",
          isCorrect: false,
        },
        optionB: {
          text: "Identify the cue and reward, then replace the routine with a better response to the same trigger",
          isCorrect: true,
        },
        correctFeedback: "Exactly. The loop is the lever. Once you see the cue and reward, you can redesign the routine.",
        wrongFeedback:
          "Not quite — the chapter argues that change gets easier when you understand the habit loop instead of just demanding more discipline.",
      },
      quiz: {
        question:
          "According to Chapter 1, what are the three parts of a habit loop?",
        options: [
          {
            letter: "A",
            text: "Trigger, action, outcome",
            isCorrect: false,
          },
          {
            letter: "B",
            text: "Cue, routine, reward",
            isCorrect: true,
          },
          {
            letter: "C",
            text: "Goal, plan, result",
            isCorrect: false,
          },
          {
            letter: "D",
            text: "Need, effort, success",
            isCorrect: false,
          },
        ],
      },
    },

    growth: {
      bookTitle: "Crucial Conversations",
      author: "Joseph Grenny, Kerry Patterson, Ron McMillan, Al Switzler",
      chapter: "Chapter 1",
      coverGradient: "linear-gradient(135deg, #0f766e, #0f172a)",
      summary: {
        mainIdea:
          "A conversation turns crucial when stakes are high, people disagree, and emotion is strong enough to distort judgment. If you miss that turn, the problem usually comes back in a disguised form.",
        keyTakeaway:
          "The first skill is recognizing the moment early enough to stop silence or force from becoming your default response.",
      },
      scenario: {
        prompt:
          "Nadia and her teammate keep trading clipped messages after a missed deadline, and the real issue is getting harder to name. Based on this chapter, what should Nadia do first?",
        optionA: {
          text: "Keep the conversation on Slack until the tension settles down on its own",
          isCorrect: false,
        },
        optionB: {
          text: "Name that the conversation matters, disagreement is real, and tension is rising before the fallout spreads",
          isCorrect: true,
        },
        correctFeedback:
          "Right. Recognition comes first. If she spots the crucial conversation early, she can address the real problem instead of chasing the downstream symptoms.",
        wrongFeedback:
          "That delay usually makes the disguised fallout worse. The chapter argues that missed crucial conversations do not disappear; they mutate.",
      },
      quiz: {
        question:
          "According to Chapter 1, what three conditions define a crucial conversation?",
        options: [
          {
            letter: "A",
            text: "A public setting, a long history, and a final decision",
            isCorrect: false,
          },
          {
            letter: "B",
            text: "High stakes, differing opinions, and strong emotions",
            isCorrect: true,
          },
          {
            letter: "C",
            text: "Clear evidence, equal power, and enough time",
            isCorrect: false,
          },
          {
            letter: "D",
            text: "A shared goal, a calm room, and formal authority",
            isCorrect: false,
          },
        ],
      },
    },
  };

export const shelfBooks: Record<PersonalizationChoice, ShelfBook[]> = {
  work: [
    {
      title: "Deep Work",
      author: "Cal Newport",
      category: "Productivity",
      gradient: "linear-gradient(135deg, #2563EB, #1D4ED8)",
    },
    {
      title: "Measure What Matters",
      author: "John Doerr",
      category: "Strategy",
      gradient: "linear-gradient(135deg, #DC2626, #B91C1C)",
    },
    {
      title: "The Hard Thing About Hard Things",
      author: "Ben Horowitz",
      category: "Leadership",
      gradient: "linear-gradient(135deg, #4B5563, #374151)",
    },
  ],
  thinking: [
    {
      title: "Thinking, Fast and Slow",
      author: "Daniel Kahneman",
      category: "Psychology",
      gradient: "linear-gradient(135deg, #0D9488, #0F766E)",
    },
    {
      title: "Mindset",
      author: "Carol S. Dweck",
      category: "Psychology",
      gradient: "linear-gradient(135deg, #7C3AED, #6D28D9)",
    },
    {
      title: "The Art of Thinking Clearly",
      author: "Rolf Dobelli",
      category: "Psychology",
      gradient: "linear-gradient(135deg, #0891B2, #0E7490)",
    },
  ],
  habits: [
    {
      title: "The Power of Habit",
      author: "Charles Duhigg",
      category: "Productivity",
      gradient: "linear-gradient(135deg, #059669, #047857)",
    },
    {
      title: "Tiny Habits",
      author: "BJ Fogg",
      category: "Productivity",
      gradient: "linear-gradient(135deg, #D4A574, #C4956A)",
    },
    {
      title: "Essentialism",
      author: "Greg McKeown",
      category: "Productivity",
      gradient: "linear-gradient(135deg, #0891B2, #0E7490)",
    },
  ],
  growth: [
    {
      title: "Crucial Conversations",
      author: "Joseph Grenny et al.",
      category: "Communication",
      gradient: "linear-gradient(135deg, #0f766e, #0f172a)",
    },
    {
      title: "The 7 Habits of Highly Effective People",
      author: "Stephen Covey",
      category: "Self-help",
      gradient: "linear-gradient(135deg, #2563EB, #1D4ED8)",
    },
    {
      title: "Emotional Intelligence",
      author: "Daniel Goleman",
      category: "Psychology",
      gradient: "linear-gradient(135deg, #7C3AED, #6D28D9)",
    },
  ],
};

/** Alternative books for the swap modal (4 per category). */
export const swapAlternatives: Record<PersonalizationChoice, ShelfBook[]> = {
  work: [
    { title: "Zero to One", author: "Peter Thiel", category: "Strategy", gradient: "linear-gradient(135deg, #1E40AF, #1E3A8A)" },
    { title: "The Lean Startup", author: "Eric Ries", category: "Startup", gradient: "linear-gradient(135deg, #059669, #047857)" },
    { title: "Good to Great", author: "Jim Collins", category: "Leadership", gradient: "linear-gradient(135deg, #7C3AED, #6D28D9)" },
    { title: "The Effective Executive", author: "Peter Drucker", category: "Management", gradient: "linear-gradient(135deg, #0891B2, #0E7490)" },
  ],
  thinking: [
    { title: "Predictably Irrational", author: "Dan Ariely", category: "Behavioral Science", gradient: "linear-gradient(135deg, #DC2626, #B91C1C)" },
    { title: "Superforecasting", author: "Philip E. Tetlock", category: "Decision Making", gradient: "linear-gradient(135deg, #4B5563, #374151)" },
    { title: "The Scout Mindset", author: "Julia Galef", category: "Critical Thinking", gradient: "linear-gradient(135deg, #D4A574, #C4956A)" },
    { title: "Noise", author: "Daniel Kahneman", category: "Psychology", gradient: "linear-gradient(135deg, #1E40AF, #1E3A8A)" },
  ],
  habits: [
    { title: "Tiny Habits", author: "BJ Fogg", category: "Behavior Design", gradient: "linear-gradient(135deg, #7C3AED, #6D28D9)" },
    { title: "Deep Work", author: "Cal Newport", category: "Productivity", gradient: "linear-gradient(135deg, #2563EB, #1D4ED8)" },
    { title: "Make It Stick", author: "Peter C. Brown", category: "Learning", gradient: "linear-gradient(135deg, #DC2626, #B91C1C)" },
    { title: "The One Thing", author: "Gary Keller", category: "Focus", gradient: "linear-gradient(135deg, #4B5563, #374151)" },
  ],
  growth: [
    { title: "Nonviolent Communication", author: "Marshall B. Rosenberg", category: "Communication", gradient: "linear-gradient(135deg, #0891B2, #0E7490)" },
    { title: "Man's Search for Meaning", author: "Viktor E. Frankl", category: "Philosophy", gradient: "linear-gradient(135deg, #4B5563, #374151)" },
    { title: "Daring Greatly", author: "Brene Brown", category: "Self-help", gradient: "linear-gradient(135deg, #DC2626, #B91C1C)" },
    { title: "Thinking, Fast and Slow", author: "Daniel Kahneman", category: "Psychology", gradient: "linear-gradient(135deg, #0D9488, #0F766E)" },
  ],
};

export const scenarioFocusLabels: Record<PersonalizationChoice, string> = {
  work: "Work first",
  thinking: "Clear thinking",
  habits: "Daily habits",
  growth: "Personal life",
};
