"use client";

import { Section } from "@/components/Section";
import { ExperienceTimeline } from "@/components/ExperienceTimeline";
import { experience } from "@/content/experience";

export function ExperienceSection() {
  return (
    <Section
      id="experience"
      title="Experience"
      subtitle="A timeline view that highlights consistency, ownership, and operational maturity."
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <p className="mb-3 text-xs font-semibold tracking-[0.22em] text-slate-400">
            WORK
          </p>
          <ExperienceTimeline items={experience.work} />
        </div>

        <div>
          <p className="mb-3 text-xs font-semibold tracking-[0.22em] text-slate-400">
            EDUCATION
          </p>
          <ExperienceTimeline items={experience.education} />
        </div>
      </div>
    </Section>
  );
}
