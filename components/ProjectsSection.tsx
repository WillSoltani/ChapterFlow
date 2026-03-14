"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import type { Project } from "@/types/project";
import { projects } from "@/content/projects";
import { ProjectCard } from "@/components/ProjectCard";
import { Button } from "@/components/ui/button";

type FilterTag = "All" | string;

function getAllTags(list: Project[]): FilterTag[] {
  const set = new Set<string>();
  for (const p of list) p.tags?.forEach((t) => set.add(t));
  return ["All", ...Array.from(set).sort()];
}

export function ProjectsSection() {
  const tags = useMemo(() => getAllTags(projects), []);
  const [active, setActive] = useState<FilterTag>("All");

  const featured = useMemo(() => projects.filter((p) => p.featured), []);
  const filtered = useMemo(() => {
    if (active === "All") return projects;
    return projects.filter((p) => p.tags?.includes(active));
  }, [active]);

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Filter bar: mobile horizontal scroll w/ fades + snap, desktop wraps */}
      <div className="relative -mx-4 px-4 sm:mx-0 sm:px-0">
        {/* fades (mobile only) */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-linear-to-r from-[#070b16] to-transparent sm:hidden" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-linear-to-l from-[#070b16] to-transparent sm:hidden" />

        <div
          className="
            overflow-x-auto sm:overflow-visible
            [-ms-overflow-style:none] [scrollbar-width:none]
            [&::-webkit-scrollbar]:hidden
          "
        >
          <div
            className="
              flex w-max gap-2 pb-1 pr-2
              sm:w-auto sm:flex-wrap sm:pb-0 sm:pr-0
              snap-x snap-mandatory sm:snap-none
            "
          >
            {tags.map((t) => {
              const isActive = active === t;
              return (
                <Button
                  key={t}
                  onClick={() => setActive(t)}
                  variant="outline"
                  className={[
                    "h-9 rounded-full px-3 text-xs sm:text-sm",
                    "border-white/10 bg-white/5 hover:bg-white/10",
                    "whitespace-nowrap snap-start",
                    "focus-visible:ring-2 focus-visible:ring-sky-300/40 focus-visible:ring-offset-0",
                    isActive ? "bg-white/12 text-slate-100" : "text-slate-300",
                  ].join(" ")}
                >
                  {t}
                </Button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Featured */}
      {featured.length > 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5 backdrop-blur-sm sm:backdrop-blur">
          <p className="mb-3 text-xs font-semibold tracking-[0.22em] text-slate-400">
            FEATURED
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {featured.slice(0, 2).map((p) => (
              <ProjectCard key={p.slug} project={p} />
            ))}
          </div>
        </div>
      ) : null}

      {/* Filtered list */}
      <motion.div layout className="grid gap-4">
        <AnimatePresence mode="popLayout">
          {filtered.map((p) => (
            <motion.div
              key={p.slug}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.18 }}
            >
              <ProjectCard project={p} />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
