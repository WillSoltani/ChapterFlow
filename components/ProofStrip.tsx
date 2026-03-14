"use client";

import { motion } from "framer-motion";
import { Shield, Cloud, Wrench, Activity } from "lucide-react";

const items = [
  { icon: Cloud, label: "AWS Certified x3" },
  { icon: Shield, label: "Security-first" },
  { icon: Activity, label: "Observability built-in" },
  { icon: Wrench, label: "IaC: CDK/CloudFormation" },
];

export function ProofStrip() {
  return (
    <div className="mx-auto max-w-6xl px-6">
      <div className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur sm:grid-cols-2 lg:grid-cols-4">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <motion.div
              key={it.label}
              whileHover={{ y: -2 }}
              transition={{ type: "spring", stiffness: 500, damping: 35 }}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3"
            >
              <Icon className="h-5 w-5 text-slate-200" />
              <p className="text-sm text-slate-200">{it.label}</p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
