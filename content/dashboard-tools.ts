export type DashboardToolAccent = "amber";
export type DashboardToolIcon = "book";

export type DashboardTool = {
  id: string;
  category: string;
  title: string;
  description: string;
  bullets: [string, string, string];
  href: string;
  ctaLabel: string;
  openLabel: string;
  accent: DashboardToolAccent;
  icon: DashboardToolIcon;
};

export const dashboardTools: DashboardTool[] = [
  {
    id: "book-accelerator",
    category: "READ & LEARN FASTER",
    title: "ChapterFlow",
    description:
      "Move through books with structured chapter sessions, practical examples, and quiz backed retention.",
    bullets: [
      "Chapter-gated quizzes",
      "Daily streak tracker",
      "Badge achievements",
    ],
    href: "/book",
    ctaLabel: "Open ChapterFlow",
    openLabel: "Open app",
    accent: "amber",
    icon: "book",
  },
];
