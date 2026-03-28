"use client";

import { useRef, useEffect, useState } from "react";
import {
  useInView,
  animate,
  useReducedMotion,
} from "framer-motion";

interface CounterAnimationProps {
  target: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  className?: string;
}

export function CounterAnimation({
  target,
  prefix = "",
  suffix = "",
  duration = 0.6,
  className = "",
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
    <span
      ref={ref}
      className={className}
      style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}
    >
      {prefix}{displayValue}{suffix}
    </span>
  );
}

export { CounterAnimation as CountUp };
