"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { DUR } from "@/lib/motion";

export function Sparkline({ data }: { data: number[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const isInView = useInView(svgRef, { once: true, margin: "-20px" });

  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const w = 200;
  const h = 56;
  const padY = 4;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - padY - ((v / max) * (h - padY * 2));
    return `${x},${y}`;
  });
  const line = `M${points.join(" L")}`;
  const area = `${line} L${w},${h} L0,${h} Z`;
  const lastX = w;
  const lastY = h - padY - (((data[data.length - 1] ?? 0) / max) * (h - padY * 2));

  return (
    <svg ref={svgRef} width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="w-full max-w-[200px]" aria-label="Daily reading sparkline">
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="color-mix(in srgb, var(--cf-data-blue) 15%, transparent)" />
          <stop offset="100%" stopColor="color-mix(in srgb, var(--cf-data-blue) 0%, transparent)" />
        </linearGradient>
      </defs>
      <motion.path
        d={area}
        fill="url(#sparkFill)"
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : {}}
        transition={{ duration: 1.2, ease: "easeOut" }}
      />
      <motion.path
        ref={pathRef}
        d={line}
        fill="none"
        stroke="var(--cf-accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={isInView ? { pathLength: 1 } : {}}
        transition={{ duration: 1.2, ease: "easeOut" }}
      />
      <motion.circle
        cx={lastX}
        cy={lastY}
        r="3"
        fill="var(--cf-accent)"
        initial={{ scale: 0, opacity: 0 }}
        animate={isInView ? { scale: 1, opacity: 1 } : {}}
        transition={{ delay: 1.2, duration: DUR.normal, ease: "easeOut" }}
      />
    </svg>
  );
}
