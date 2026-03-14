"use client";

import { Section } from "@/components/Section";
import { ProjectsSection } from "@/components/ProjectsSection";

export function ProjectsBlock() {
  return (
    <Section
      id="projects"
      title="Projects"
      subtitle="Portfolio-grade builds with real security, reliability, and observability. Click into a case study for architecture + tradeoffs."
    >
      <ProjectsSection />
    </Section>
  );
}
