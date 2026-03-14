"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ExternalLink, Github, ArrowRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/Chip";
import type { Project } from "@/types/project";

type Props = { project: Project };

export function ProjectCard({ project }: Props) {
  const tags = project.tags ?? [];
  const hasGithub = Boolean(project.githubUrl);
  const hasDemo = Boolean(project.demoUrl);

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
    >
      <Card className="group relative overflow-hidden border-white/10 bg-white/5 p-5 backdrop-blur-sm sm:p-6 sm:backdrop-blur">
        {/* hover gradient overlay */}
        <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100 bg-[radial-gradient(700px_circle_at_20%_10%,rgba(56,189,248,0.12),transparent_60%)]" />

        {/* Content + actions: stack on mobile/tablet, split on lg */}
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          {/* Left: content */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-slate-100 sm:text-lg">
                {project.title}
              </h3>

              {project.featured ? (
                <span className="relative">
                  <span className="absolute -inset-2 rounded-full bg-sky-400/10 blur-md" />
                  <Badge className="relative bg-sky-500/10 text-sky-300 hover:bg-sky-500/10">
                    Featured
                  </Badge>
                </span>
              ) : null}
            </div>

            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              {project.description}
            </p>

            {tags.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {tags.map((t) => (
                  <span key={t} className="inline-flex">
                    <Chip>{t}</Chip>
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          {/* Right: actions */}
          <div className="flex w-full flex-col gap-3 lg:w-auto lg:shrink-0 lg:items-end lg:gap-2">
            <Button
              asChild
              className="w-full border border-white/10 bg-white/10 text-slate-100 hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-sky-300/40 lg:w-auto"
            >
              <Link href={`/projects/${project.slug}`}>
              <span className="inline-flex w-full items-center justify-center gap-2">
                  Case Study
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </span>
              </Link>
            </Button>

            {(hasGithub || hasDemo) ? (
              <div className="flex w-full items-center justify-start gap-2 lg:w-auto lg:justify-end">
                {hasGithub ? (
                  <motion.a
                    href={project.githubUrl}
                    target="_blank"
                    rel="noreferrer"
                    whileHover={{ scale: 1.06 }}
                    whileTap={{ scale: 0.96 }}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/40"
                    aria-label="Open GitHub repository"
                    title="GitHub"
                  >
                    <Github className="h-4 w-4" />
                  </motion.a>
                ) : null}

                {hasDemo ? (
                  <motion.a
                    href={project.demoUrl}
                    target="_blank"
                    rel="noreferrer"
                    whileHover={{ scale: 1.06 }}
                    whileTap={{ scale: 0.96 }}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/40"
                    aria-label="Open live demo"
                    title="Live demo"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </motion.a>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
