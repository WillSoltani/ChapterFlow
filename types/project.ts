export type CaseStudyDecision = {
  title: string;
  detail: string;
};

export type CaseStudy = {
  // Keep what you already have
  overview: string;
  architecture: string[];
  decisions: CaseStudyDecision[];
  security: string[];
  observability: string[];
  failureModes: string[];
  cost: string[];
  next: string[];

  // NEW (optional): lets you match the screenshot sections exactly
  problem?: string;   // Problem Statement
  solution?: string;  // Solution

  // NEW (optional): for your diagram section
  diagram?: {
    src: string;            // e.g. "/diagrams/serverless-file-pipeline.png"
    alt?: string;
    caption?: string;
    width?: number;
    height?: number;
    priority?: boolean;     // Next/Image priority
  };

  // NEW (optional): if you want “Key Takeaways” separate from “Next”
  takeaways?: string[];
};

export type Project = {
  slug: string;
  title: string;
  description: string;

  githubUrl?: string;
  demoUrl?: string;
  tags?: string[];
  featured?: boolean;

  type?: string;
  stack?: string;
  status?: string;

  caseStudy?: CaseStudy;
};
