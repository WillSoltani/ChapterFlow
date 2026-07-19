"use client";

import { useEffect, useRef } from "react";
import { useMotionValue, useTransform, useInView, animate } from "framer-motion";

export function AnimatedNumber({
  value,
  duration = 0.8,
  formatFn,
}: {
  value: number;
  duration?: number;
  formatFn?: (v: number) => string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-20px" });
  const motionVal = useMotionValue(0);
  const rounded = useTransform(motionVal, (v) =>
    formatFn ? formatFn(v) : String(Math.round(v))
  );

  useEffect(() => {
    if (!isInView) return;
    const controls = animate(motionVal, value, { duration, ease: "easeOut" });
    return controls.stop;
  }, [isInView, value, duration, motionVal]);

  useEffect(() => {
    return rounded.on("change", (v) => {
      if (ref.current) ref.current.textContent = v;
    });
  }, [rounded]);

  return <span ref={ref}>0</span>;
}
