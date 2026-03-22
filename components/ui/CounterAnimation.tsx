"use client";

import { useRef, useEffect, useState } from "react";
import {
  useInView,
  animate,
  useReducedMotion,
} from "framer-motion";

interface CounterAnimationProps {
  target: number;
  suffix?: string;
  duration?: number;
}

export function CounterAnimation({
  target,
  suffix = "",
  duration = 1.5,
}: CounterAnimationProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.5 });
  const prefersReducedMotion = useReducedMotion();
  const [displayValue, setDisplayValue] = useState(
    prefersReducedMotion ? target : 0
  );
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (isInView && !hasAnimated.current) {
      hasAnimated.current = true;

      if (prefersReducedMotion) {
        setDisplayValue(target);
        return;
      }

      const controls = animate(0, target, {
        duration,
        ease: "easeOut",
        onUpdate(value) {
          setDisplayValue(Math.round(value));
        },
      });

      return () => controls.stop();
    }
  }, [isInView, target, duration, prefersReducedMotion]);

  return (
    <span ref={ref} style={{ fontFamily: "'JetBrains Mono', monospace" }}>
      {displayValue}
      {suffix}
    </span>
  );
}
