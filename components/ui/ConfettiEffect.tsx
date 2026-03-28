"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, animate, useReducedMotion } from "framer-motion";

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  angle: number;
  distance: number;
}

interface ConfettiEffectProps {
  trigger: boolean;
  colors?: string[];
}

const DEFAULT_COLORS = ["var(--accent-emerald)", "var(--accent-cyan)", "var(--accent-emerald)", "var(--text-heading)"];
const PARTICLE_COUNT = 40;
const ANIMATION_DURATION = 2;

export function ConfettiEffect({
  trigger,
  colors = DEFAULT_COLORS,
}: ConfettiEffectProps) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const prevTrigger = useRef(false);
  const prefersReducedMotion = useReducedMotion();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const spawnParticles = useCallback(() => {
    const newParticles: Particle[] = Array.from(
      { length: PARTICLE_COUNT },
      (_, i) => ({
        id: Date.now() + i,
        x: 0,
        y: 0,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 6 + Math.random() * 4,
        angle: Math.random() * Math.PI * 2,
        distance: 80 + Math.random() * 120,
      })
    );
    setParticles(newParticles);

    timeoutRef.current = setTimeout(() => {
      setParticles([]);
    }, ANIMATION_DURATION * 1000 + 100);
  }, [colors]);

  useEffect(() => {
    if (trigger && !prevTrigger.current) {
      if (prefersReducedMotion) {
        return;
      }
      spawnParticles();
    }
    prevTrigger.current = trigger;
  }, [trigger, spawnParticles, prefersReducedMotion]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    >
      {particles.map((particle) => {
        const targetX = Math.cos(particle.angle) * particle.distance;
        const targetY =
          Math.sin(particle.angle) * particle.distance - 60;
        const gravityY = targetY + 140;

        return (
          <motion.div
            key={particle.id}
            initial={{
              position: "absolute",
              left: "50%",
              top: "50%",
              x: 0,
              y: 0,
              opacity: 1,
              scale: 1,
            }}
            animate={{
              x: targetX,
              y: [0, targetY, gravityY],
              opacity: [1, 1, 0],
              scale: [1, 1, 0.4],
            }}
            transition={{
              duration: ANIMATION_DURATION,
              ease: "easeOut",
              y: {
                duration: ANIMATION_DURATION,
                ease: [0.25, 0, 0.5, 1],
              },
              opacity: {
                duration: ANIMATION_DURATION,
                times: [0, 0.6, 1],
              },
              scale: {
                duration: ANIMATION_DURATION,
                times: [0, 0.5, 1],
              },
            }}
            style={{
              width: particle.size,
              height: particle.size,
              borderRadius: "50%",
              backgroundColor: particle.color,
              marginLeft: -particle.size / 2,
              marginTop: -particle.size / 2,
            }}
          />
        );
      })}
    </div>
  );
}
