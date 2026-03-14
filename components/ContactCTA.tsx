"use client";

import { motion } from "framer-motion";
import { Mail, Github, Linkedin } from "lucide-react";

import { Card } from "@/components/ui/card";

type Props = {
  email: string;
  githubUrl: string;
  linkedinUrl: string;
};

function PillLink(props: {
  href: string;
  label: string;
  icon: React.ReactNode;
  external?: boolean;
  gradientClass: string;
  hoverShadowClass: string;
}) {
  const { href, label, icon, external, gradientClass, hoverShadowClass } = props;

  return (
    <motion.a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.96 }}
      className={[
        // HARD LOCK: identical button geometry for all 3
        "relative inline-flex h-11 items-center justify-center gap-2",
        "rounded-full px-5",
        "whitespace-nowrap",

        // Identical chrome
        "border border-white/10",
        "bg-white/5",
        "text-sm font-medium text-slate-100",
        "backdrop-blur",

        // Identical hover behavior
        "transition",
        "hover:border-white/15",
        "hover:bg-white/8",

        // Prevent any layout differences from icon/text
        "[&>svg]:shrink-0",

        // Gradient + glow theme
        "overflow-hidden",
        gradientClass,
        hoverShadowClass,
      ].join(" ")}
    >
      {/* subtle sheen */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 hover:opacity-100"
      />
      <span className="pointer-events-none absolute inset-0">
        <span className="absolute -left-1/3 top-0 h-full w-1/2 rotate-12 bg-white/10 blur-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      </span>

      <span className="relative inline-flex items-center gap-2">
        {icon}
        <span>{label}</span>
      </span>
    </motion.a>
  );
}

export function ContactCTA({ email, githubUrl, linkedinUrl }: Props) {
  return (
    <Card className="group relative overflow-hidden border-white/10 bg-white/5 p-8 text-center backdrop-blur">
      {/* Subtle section gradient */}
      <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100 bg-[radial-gradient(800px_circle_at_50%_10%,rgba(56,189,248,0.10),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_circle_at_50%_120%,rgba(139,92,246,0.08),transparent_55%)]" />

      <div className="relative">
        <h3 className="text-2xl font-semibold bg-gradient-to-b from-white to-slate-300 bg-clip-text text-transparent">
          Let’s Connect
        </h3>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-300">
          I’m looking for cloud roles and I love building production-style AWS projects.
          Reach out for opportunities, collaborations, or code reviews.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <PillLink
            href={`mailto:${email}`}
            label="Email"
            icon={<Mail className="h-4 w-4" />}
            gradientClass="bg-gradient-to-r from-sky-500/20 via-emerald-500/15 to-violet-500/20"
            hoverShadowClass="hover:shadow-[0_12px_50px_rgba(56,189,248,0.18)]"
          />

          <PillLink
            href={githubUrl}
            label="GitHub"
            icon={<Github className="h-4 w-4" />}
            external
            gradientClass="bg-gradient-to-r from-sky-500/20 via-emerald-500/15 to-violet-500/20"
            hoverShadowClass="hover:shadow-[0_12px_50px_rgba(56,189,248,0.18)]"
          />

          <PillLink
            href={linkedinUrl}
            label="LinkedIn"
            icon={<Linkedin className="h-4 w-4" />}
            external
            gradientClass="bg-gradient-to-r from-sky-500/20 via-emerald-500/15 to-violet-500/20"
            hoverShadowClass="hover:shadow-[0_12px_50px_rgba(56,189,248,0.18)]"
          />
        </div>
      </div>
    </Card>
  );
}
