"use client";

import { Section } from "@/components/Section";
import { ContactCTA } from "@/components/ContactCTA";
import { SiteFooter } from "@/components/SiteFooter";

export function ContactSection() {
  return (
    <Section id="contact" title="Contact">
      <ContactCTA
        email="will@soltani.org"
        githubUrl="https://github.com/WillSoltani"
        linkedinUrl="https://www.linkedin.com/in/will-soltani"
      />
      <SiteFooter />
    </Section>
  );
}
