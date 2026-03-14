"use client";

import { Section } from "@/components/Section";
import { Card } from "@/components/ui/card";
import { about } from "@/content/about";

export function AboutSection() {
  return (
    <Section
      id="about"
      title={about.headline}
      subtitle="How I approach building cloud systems."
    >
      <Card className="border-white/10 bg-white/5 p-6 backdrop-blur">
        <ul className="list-disc space-y-3 pl-5 text-sm text-slate-300">
          {about.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        <p className="mt-5 text-sm text-slate-300">{about.closing}</p>
      </Card>
    </Section>
  );
}
