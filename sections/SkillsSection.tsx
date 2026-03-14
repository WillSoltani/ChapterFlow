"use client";

import { motion, type Variants } from "framer-motion";

import { Section } from "@/components/Section";
import { SkillCategoryCard } from "@/components/SkillCategoryCard";
import { skillCategories } from "@/content/skills";

const skillsWrap: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08 },
  },
};

export function SkillsSection() {
  return (
    <Section
      id="skills"
      title="Skills"
      subtitle="A curated stack for building reliable, secure, and production-ready cloud systems."
    >
      <motion.div
        variants={skillsWrap}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.2 }}
        className="grid gap-4 md:grid-cols-2 items-stretch auto-rows-fr"
      >
        {skillCategories.map((cat) => (
          <SkillCategoryCard key={cat.title} cat={cat} />
        ))}
      </motion.div>
    </Section>
  );
}
