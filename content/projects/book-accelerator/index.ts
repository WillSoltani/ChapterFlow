import type { Project } from "@/types/project";

export const bookAccelerator: Project = {
  slug: "book-accelerator",
  title: "ChapterFlow",
  description:
    "A guided reading app that combines chapter summaries, practical examples, and quiz-gated progression to improve retention.",
  tags: ["EdTech", "Product Design", "Web App", "Learning UX"],
  featured: true,

  type: "Learning Web App",
  stack: "Next.js, TypeScript, Local-first state",
  status: "In progress",

  caseStudy: {
    overview:
      "ChapterFlow is designed to make reading active instead of passive. Each chapter is broken into summaries, examples, and quizzes that unlock the next chapter only after passing.",
    architecture: [
      "Onboarding flow captures goals and reading preferences",
      "Library, chapter detail, and chapter reader routes share a unified state model",
      "Local persistence keeps progress, quiz scores, notes, and preferences stable across sessions",
    ],
    decisions: [
      {
        title: "Quiz-gated progression",
        detail:
          "Users must pass chapter quizzes to unlock the next chapter, reinforcing comprehension before progressing.",
      },
      {
        title: "Local-first data model for UI phase",
        detail:
          "The current UI phase stores state in localStorage so product behavior is testable end-to-end before backend rollout.",
      },
    ],
    security: [
      "Client state is scoped to browser storage with explicit reset controls",
      "No external content execution in chapter rendering",
      "Prepared backend contract for server-side entitlement and progress enforcement",
    ],
    observability: [
      "Consistent state keys for dashboard, book progress, and notes",
      "Structured error banners and empty-state fallbacks across main routes",
      "Deterministic chapter/quiz models for reliable QA coverage",
    ],
    failureModes: [
      "Safe hydration fallbacks when localStorage content is malformed",
      "Locked chapter safeguards prevent invalid navigation",
      "Graceful empty states when onboarding has not been completed",
    ],
    cost: [
      "Frontend-only UI phase has near-zero runtime cost",
      "Backend plan uses serverless primitives to keep ingestion and API costs predictable",
    ],
    next: [
      "Integrate published book ingestion and versioning",
      "Add server-side progress sync and entitlement enforcement",
      "Enable Stripe-backed Pro subscription for extended access",
    ],
  },
};
