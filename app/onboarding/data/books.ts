/* ── Book catalog for onboarding ── */

export interface OnboardingBook {
  id: string;
  title: string;
  author: string;
  category: string;
  difficulty: "Easy" | "Medium" | "Hard";
  estimatedHours: number;
  gradient: string;
  interests: string[]; // which interest categories this book maps to
  tagline: string;     // short 1-sentence description for swipe cards
  coverId?: string;    // filename in public/book-covers/ (without extension)
}

/** Map book id to the cover filename in public/book-covers/ */
const COVER_MAP: Record<string, string> = {
  "thinking-fast-slow": "thinking-fast-and-slow",
  "predictably-irrational": "predictably-irrational",
  "atomic-habits": "atomic-habits",
  "deep-work": "deep-work",
  "power-of-habit": "the-power-of-habit",
  "essentialism": "essentialism",
  "hard-thing": "the-hard-thing-about-hard-things",
  "good-to-great": "good-to-great",
  "zero-to-one": "zero-to-one",
  "measure-what-matters": "measure-what-matters",
  "art-of-war": "art-of-war",
  "never-split-difference": "never-split-the-difference",
  "mans-search-meaning": "mans-search-for-meaning",
  "meditations": "meditations",
  "lean-startup": "the-lean-startup",
  "thinking-in-bets": "thinking-in-bets",
  "psychology-of-money": "the-psychology-of-money",
  "48-laws-power": "the-48-laws-of-power",
  "7-habits": "the-7-habits-of-highly-effective-people",
  "tiny-habits": "tiny-habits",
  "make-it-stick": "make-it-stick",
  "mindset": "mindset",
};

/** Get cover image path for a book (returns null if no cover available) */
export function getBookCoverPath(bookId: string): string | null {
  const coverId = COVER_MAP[bookId];
  if (!coverId) return null;
  return `/book-covers/${coverId}.jpg`;
}

export const ONBOARDING_BOOKS: OnboardingBook[] = [
  // Psychology
  { id: "thinking-fast-slow", title: "Thinking, Fast and Slow", author: "Daniel Kahneman", category: "Psychology", difficulty: "Hard", estimatedHours: 4.2, gradient: "linear-gradient(135deg, #0D9488, #0F766E)", interests: ["psychology", "decision-making", "science"], tagline: "Two systems shape every decision you make." },
  { id: "mindset", title: "Mindset", author: "Carol S. Dweck", category: "Psychology", difficulty: "Easy", estimatedHours: 2.1, gradient: "linear-gradient(135deg, #7C3AED, #6D28D9)", interests: ["psychology", "education", "self-awareness"], tagline: "Your beliefs about ability change everything." },
  { id: "emotional-intelligence", title: "Emotional Intelligence", author: "Daniel Goleman", category: "Psychology", difficulty: "Medium", estimatedHours: 3.0, gradient: "linear-gradient(135deg, #DC2626, #B91C1C)", interests: ["psychology", "relationships", "self-awareness"], tagline: "EQ matters more than IQ for real-world success." },
  { id: "predictably-irrational", title: "Predictably Irrational", author: "Dan Ariely", category: "Psychology", difficulty: "Medium", estimatedHours: 2.8, gradient: "linear-gradient(135deg, #F59E0B, #D97706)", interests: ["psychology", "decision-making"], tagline: "You're irrational — but in very predictable ways." },

  // Productivity
  { id: "atomic-habits", title: "Atomic Habits", author: "James Clear", category: "Productivity", difficulty: "Easy", estimatedHours: 2.4, gradient: "linear-gradient(135deg, #D4A574, #C4956A)", interests: ["productivity", "habits", "self-awareness"], tagline: "Small habits compound into remarkable results." },
  { id: "deep-work", title: "Deep Work", author: "Cal Newport", category: "Productivity", difficulty: "Medium", estimatedHours: 2.8, gradient: "linear-gradient(135deg, #2563EB, #1D4ED8)", interests: ["productivity", "technology"], tagline: "Focused work is the new superpower." },
  { id: "power-of-habit", title: "The Power of Habit", author: "Charles Duhigg", category: "Productivity", difficulty: "Medium", estimatedHours: 3.0, gradient: "linear-gradient(135deg, #059669, #047857)", interests: ["productivity", "habits", "psychology"], tagline: "Habits run on a loop — and you can rewrite it." },
  { id: "essentialism", title: "Essentialism", author: "Greg McKeown", category: "Productivity", difficulty: "Easy", estimatedHours: 2.2, gradient: "linear-gradient(135deg, #0891B2, #0E7490)", interests: ["productivity", "decision-making"], tagline: "Do less, but do it better." },

  // Leadership
  { id: "hard-thing", title: "The Hard Thing About Hard Things", author: "Ben Horowitz", category: "Leadership", difficulty: "Medium", estimatedHours: 2.8, gradient: "linear-gradient(135deg, #4B5563, #374151)", interests: ["leadership", "entrepreneurship", "strategy"], tagline: "No playbook for the hardest decisions." },
  { id: "good-to-great", title: "Good to Great", author: "Jim Collins", category: "Leadership", difficulty: "Medium", estimatedHours: 3.2, gradient: "linear-gradient(135deg, #1E40AF, #1E3A8A)", interests: ["leadership", "strategy"], tagline: "What separates good companies from great ones." },
  { id: "leaders-eat-last", title: "Leaders Eat Last", author: "Simon Sinek", category: "Leadership", difficulty: "Easy", estimatedHours: 2.4, gradient: "linear-gradient(135deg, #B45309, #92400E)", interests: ["leadership", "communication"], tagline: "Great leaders create safety, not fear." },

  // Strategy
  { id: "zero-to-one", title: "Zero to One", author: "Peter Thiel", category: "Strategy", difficulty: "Medium", estimatedHours: 2.0, gradient: "linear-gradient(135deg, #1E40AF, #1E3A8A)", interests: ["strategy", "entrepreneurship", "technology"], tagline: "Build something nobody else has imagined." },
  { id: "measure-what-matters", title: "Measure What Matters", author: "John Doerr", category: "Strategy", difficulty: "Medium", estimatedHours: 2.6, gradient: "linear-gradient(135deg, #DC2626, #B91C1C)", interests: ["strategy", "productivity", "leadership"], tagline: "OKRs turn ambition into measurable action." },
  { id: "art-of-war", title: "The Art of War", author: "Sun Tzu", category: "Strategy", difficulty: "Medium", estimatedHours: 1.4, gradient: "linear-gradient(135deg, #78350F, #451A03)", interests: ["strategy", "history", "leadership"], tagline: "Ancient strategy for modern conflict." },

  // Communication
  { id: "how-to-win-friends", title: "How to Win Friends and Influence People", author: "Dale Carnegie", category: "Communication", difficulty: "Easy", estimatedHours: 2.6, gradient: "linear-gradient(135deg, #059669, #047857)", interests: ["communication", "relationships"], tagline: "The timeless guide to human connection." },
  { id: "never-split-difference", title: "Never Split the Difference", author: "Chris Voss", category: "Communication", difficulty: "Medium", estimatedHours: 2.4, gradient: "linear-gradient(135deg, #991B1B, #7F1D1D)", interests: ["communication", "negotiation", "psychology"], tagline: "FBI hostage tactics for everyday negotiations." },
  { id: "nonviolent-communication", title: "Nonviolent Communication", author: "Marshall Rosenberg", category: "Communication", difficulty: "Easy", estimatedHours: 2.2, gradient: "linear-gradient(135deg, #0891B2, #0E7490)", interests: ["communication", "relationships"], tagline: "Speak so people hear. Listen so people speak." },

  // Philosophy
  { id: "mans-search-meaning", title: "Man's Search for Meaning", author: "Viktor Frankl", category: "Philosophy", difficulty: "Medium", estimatedHours: 1.8, gradient: "linear-gradient(135deg, #4B5563, #374151)", interests: ["philosophy", "psychology", "self-awareness"], tagline: "Purpose is the antidote to suffering." },
  { id: "meditations", title: "Meditations", author: "Marcus Aurelius", category: "Philosophy", difficulty: "Medium", estimatedHours: 2.0, gradient: "linear-gradient(135deg, #78716C, #57534E)", interests: ["philosophy", "self-awareness", "habits"], tagline: "A Roman emperor's private journal on resilience." },

  // Negotiation
  { id: "getting-to-yes", title: "Getting to Yes", author: "Roger Fisher", category: "Negotiation", difficulty: "Easy", estimatedHours: 2.0, gradient: "linear-gradient(135deg, #4338CA, #3730A3)", interests: ["negotiation", "communication", "strategy"], tagline: "Negotiate agreements without giving in." },

  // Entrepreneurship
  { id: "lean-startup", title: "The Lean Startup", author: "Eric Ries", category: "Entrepreneurship", difficulty: "Medium", estimatedHours: 2.6, gradient: "linear-gradient(135deg, #059669, #047857)", interests: ["entrepreneurship", "strategy", "technology"], tagline: "Build, measure, learn — before you run out of money." },

  // Science
  { id: "sapiens", title: "Sapiens", author: "Yuval Noah Harari", category: "Science", difficulty: "Medium", estimatedHours: 4.0, gradient: "linear-gradient(135deg, #92400E, #78350F)", interests: ["science", "history", "philosophy"], tagline: "How a fragile ape conquered the planet." },

  // Health & Wellness
  { id: "why-we-sleep", title: "Why We Sleep", author: "Matthew Walker", category: "Health & Wellness", difficulty: "Medium", estimatedHours: 3.2, gradient: "linear-gradient(135deg, #1E3A5F, #0F2942)", interests: ["health-wellness", "science", "habits"], tagline: "Sleep is your brain's non-negotiable reset." },

  // Decision-Making
  { id: "thinking-in-bets", title: "Thinking in Bets", author: "Annie Duke", category: "Decision-Making", difficulty: "Medium", estimatedHours: 2.4, gradient: "linear-gradient(135deg, #7C3AED, #5B21B6)", interests: ["decision-making", "psychology", "strategy"], tagline: "Make smarter choices under uncertainty." },
  { id: "scout-mindset", title: "The Scout Mindset", author: "Julia Galef", category: "Decision-Making", difficulty: "Easy", estimatedHours: 2.0, gradient: "linear-gradient(135deg, #D4A574, #C4956A)", interests: ["decision-making", "psychology"], tagline: "See things as they are, not as you wish." },

  // Creativity
  { id: "steal-like-artist", title: "Steal Like an Artist", author: "Austin Kleon", category: "Creativity", difficulty: "Easy", estimatedHours: 1.2, gradient: "linear-gradient(135deg, #0F172A, #1E293B)", interests: ["creativity", "writing"], tagline: "Originality starts with imitation." },

  // Finance
  { id: "psychology-of-money", title: "The Psychology of Money", author: "Morgan Housel", category: "Finance", difficulty: "Easy", estimatedHours: 2.2, gradient: "linear-gradient(135deg, #15803D, #166534)", interests: ["finance", "psychology", "decision-making"], tagline: "Wealth is what you don't spend." },

  // History
  { id: "48-laws-power", title: "The 48 Laws of Power", author: "Robert Greene", category: "History", difficulty: "Hard", estimatedHours: 5.0, gradient: "linear-gradient(135deg, #991B1B, #7F1D1D)", interests: ["history", "strategy", "leadership"], tagline: "3,000 years of power distilled into 48 laws." },

  // Technology
  { id: "hooked", title: "Hooked", author: "Nir Eyal", category: "Technology", difficulty: "Easy", estimatedHours: 2.0, gradient: "linear-gradient(135deg, #6D28D9, #5B21B6)", interests: ["technology", "psychology", "entrepreneurship"], tagline: "How products form habits you can't quit." },

  // Relationships
  { id: "7-habits", title: "The 7 Habits of Highly Effective People", author: "Stephen Covey", category: "Self-Help", difficulty: "Medium", estimatedHours: 3.4, gradient: "linear-gradient(135deg, #2563EB, #1D4ED8)", interests: ["relationships", "habits", "leadership"], tagline: "Effectiveness starts with character, not shortcuts." },
  { id: "daring-greatly", title: "Daring Greatly", author: "Brené Brown", category: "Self-Help", difficulty: "Easy", estimatedHours: 2.4, gradient: "linear-gradient(135deg, #DC2626, #B91C1C)", interests: ["relationships", "self-awareness"], tagline: "Vulnerability is the birthplace of courage." },

  // Habits
  { id: "tiny-habits", title: "Tiny Habits", author: "BJ Fogg", category: "Habits", difficulty: "Easy", estimatedHours: 2.2, gradient: "linear-gradient(135deg, #7C3AED, #6D28D9)", interests: ["habits", "productivity", "psychology"], tagline: "Make it tiny, make it happen." },
  { id: "make-it-stick", title: "Make It Stick", author: "Peter C. Brown", category: "Education", difficulty: "Medium", estimatedHours: 2.6, gradient: "linear-gradient(135deg, #DC2626, #B91C1C)", interests: ["education", "habits", "science"], tagline: "The science of learning that actually lasts." },

  // Marketing
  { id: "contagious", title: "Contagious", author: "Jonah Berger", category: "Marketing", difficulty: "Easy", estimatedHours: 2.2, gradient: "linear-gradient(135deg, #EA580C, #C2410C)", interests: ["marketing", "psychology", "communication"], tagline: "Why things catch on — and how to make yours." },

  // Self-Awareness
  { id: "subtle-art", title: "The Subtle Art of Not Giving a F*ck", author: "Mark Manson", category: "Self-Help", difficulty: "Easy", estimatedHours: 2.0, gradient: "linear-gradient(135deg, #EA580C, #9A3412)", interests: ["self-awareness", "philosophy"], tagline: "Choose your battles. Ignore the rest." },

  // Writing
  { id: "on-writing", title: "On Writing", author: "Stephen King", category: "Writing", difficulty: "Easy", estimatedHours: 2.4, gradient: "linear-gradient(135deg, #1E293B, #0F172A)", interests: ["writing", "creativity"], tagline: "Half memoir, half masterclass on the craft." },

  // Education
  { id: "range", title: "Range", author: "David Epstein", category: "Education", difficulty: "Medium", estimatedHours: 3.0, gradient: "linear-gradient(135deg, #0284C7, #0369A1)", interests: ["education", "science", "creativity"], tagline: "Generalists triumph in a specialized world." },
];

export function getBookById(id: string): OnboardingBook | undefined {
  return ONBOARDING_BOOKS.find((b) => b.id === id);
}
