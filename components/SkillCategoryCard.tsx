"use client";

import { motion, type Variants } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/Chip";

import {
  Cloud,
  Database,
  Container,
  Shield,
  Activity,
  Wrench,
} from "lucide-react";

type SkillCategory = {
  title: string;
  items: string[];
};

type Props = { cat: SkillCategory };

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: "easeOut" },
  },
};


function getStyle(title: string) {
  const key = title.toLowerCase();

  if (key.includes("serverless") || key.includes("aws")) {
    return {
      Icon: Cloud,
      glow:
        "bg-[radial-gradient(700px_circle_at_20%_10%,rgba(249,115,22,0.14),transparent_60%)]",
    };
  }
  if (key.includes("database")) {
    return {
      Icon: Database,
      glow:
        "bg-[radial-gradient(700px_circle_at_20%_10%,rgba(56,189,248,0.14),transparent_60%)]",
    };
  }
  if (key.includes("container")) {
    return {
      Icon: Container,
      glow:
        "bg-[radial-gradient(700px_circle_at_20%_10%,rgba(34,197,94,0.12),transparent_60%)]",
    };
  }
  if (key.includes("security")) {
    return {
      Icon: Shield,
      glow:
        "bg-[radial-gradient(700px_circle_at_20%_10%,rgba(168,85,247,0.12),transparent_60%)]",
    };
  }
  if (key.includes("observ")) {
    return {
      Icon: Activity,
      glow:
        "bg-[radial-gradient(700px_circle_at_20%_10%,rgba(56,189,248,0.12),transparent_60%)]",
    };
  }
  return {
    Icon: Wrench,
    glow:
      "bg-[radial-gradient(700px_circle_at_20%_10%,rgba(148,163,184,0.10),transparent_60%)]",
  };
}

export function SkillCategoryCard({ cat }: Props) {
  const { Icon, glow } = getStyle(cat.title);

  return (
    <motion.div
      variants={cardVariants}
      whileHover={{ y: -3, scale: 1.01 }}
      transition={{ type: "spring", stiffness: 450, damping: 30 }}
      className="h-full"
    >
      <Card className="group relative h-full overflow-hidden border-white/10 bg-white/5 p-6 backdrop-blur">
        {/* hover glow */}
        <div
          className={[
            "pointer-events-none absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-100",
            glow,
          ].join(" ")}
        />

        <div className="relative flex h-full flex-col">
          {/* Header: fixed structure so everything aligns */}
          <div className="flex min-h-[52px] items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5">
              <Icon className="h-5 w-5 text-slate-200 transition group-hover:scale-110" />
            </span>

            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold text-slate-100">
                {cat.title}
              </h3>
              <p className="text-xs text-slate-400">Key tools</p>
            </div>
          </div>

          {/* Chips: consistent spacing + wrap */}
          <div className="mt-4 flex flex-wrap gap-2">
            {cat.items.map((item) => (
              <motion.span
                key={item}
                whileHover={{ scale: 1.05 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="inline-flex"
              >
                <Chip>{item}</Chip>
              </motion.span>
            ))}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
