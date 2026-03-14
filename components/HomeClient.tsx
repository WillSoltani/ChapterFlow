"use client";

import { Hero } from "@/components/Hero";
import { ProofStrip } from "@/components/ProofStrip";
import { DeliveryStrip } from "@/components/DeliveryStrip";
import { ScrollToTop } from "@/components/ScrollToTop";

import { delivery } from "@/content/delivery";

import { AboutSection } from "@/sections/AboutSection";
import { CertificationsSection } from "@/sections/CertificationsSection";
import { SkillsSection } from "@/sections/SkillsSection";
import { ProjectsBlock } from "@/sections/ProjectsBlock";
import { ExperienceSection } from "@/sections/ExperienceSection";
import { ContactSection } from "@/sections/ContactSection";

export function HomeClient() {
  return (
    <>
      <Hero />
      <ProofStrip />
      <DeliveryStrip items={delivery} />
      <AboutSection />
      <CertificationsSection />
      <SkillsSection />
      <ProjectsBlock />
      <ExperienceSection />
      <ContactSection />

      <ScrollToTop />
    </>
  );
}
