"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

export interface ConfettiProps {
  /**
   * Controlled fire: bursts once each time this flips false → true (celebration
   * moments). Omit to fire once on mount.
   */
  trigger?: boolean;
  /** Number of particles. */
  particleCount?: number;
  /** Total run time before fade-out, in ms. */
  duration?: number;
  /**
   * Particle colors. CSS colors, `var(--token)`, or bare `--token` names — token
   * names are resolved against the current theme at fire time, so the palette is
   * brand-correct and visible on BOTH light and dark.
   */
  colors?: string[];
  /** "top" rains down (default); "center" bursts outward. */
  origin?: "top" | "center";
  /** Stacking order for the fixed full-screen canvas. */
  zIndex?: number;
  className?: string;
}

const DEFAULT_COLOR_TOKENS = [
  "--accent-cyan",
  "--accent-emerald",
  "--accent-amber",
  "--accent-violet",
  "--accent-gold",
];

/** Resolve a color input to a concrete color the canvas can paint.
 *  `--token` and `var(--token)` are read from the live computed styles (so the
 *  palette themes correctly); raw colors pass through unchanged. */
function resolveColor(input: string, root: HTMLElement): string {
  const trimmed = input.trim();
  let token: string | null = null;
  if (trimmed.startsWith("--")) {
    token = trimmed;
  } else {
    const m = trimmed.match(/^var\((--[^,)]+)/);
    if (m) token = m[1];
  }
  if (!token) return trimmed;
  const value = getComputedStyle(root).getPropertyValue(token).trim();
  return value || trimmed;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  shape: "rect" | "circle" | "strip";
  opacity: number;
  gravity: number;
}

/**
 * Single shared confetti primitive (canvas-based — one element regardless of
 * particle count). Replaces the dead components/ui/ConfettiEffect and the
 * onboarding CanvasConfetti's `mixBlendMode:"screen"` (which made particles
 * invisible on the default light theme). Honors reduced motion (renders nothing)
 * via framer's useReducedMotion(), which MotionProvider wires to the OS setting
 * AND the in-app reduce-motion toggle.
 */
export function Confetti({
  trigger,
  particleCount = 100,
  duration = 3500,
  colors,
  origin = "top",
  zIndex = 50,
  className = "",
}: ConfettiProps) {
  const prefersReduced = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fireKey, setFireKey] = useState(0);
  const prevTrigger = useRef(false);

  // Decide when to burst: once on mount when uncontrolled, else on false→true.
  useEffect(() => {
    if (trigger === undefined) {
      setFireKey((k) => k + 1);
      return;
    }
    if (trigger && !prevTrigger.current) setFireKey((k) => k + 1);
    prevTrigger.current = trigger;
  }, [trigger]);

  useEffect(() => {
    if (prefersReduced || fireKey === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const root = document.documentElement;
    const palette = (colors && colors.length ? colors : DEFAULT_COLOR_TOKENS).map((c) =>
      resolveColor(c, root),
    );

    const setSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    setSize();
    window.addEventListener("resize", setSize);

    const shapes: Particle["shape"][] = ["rect", "circle", "strip"];
    const fromCenter = origin === "center";
    const particles: Particle[] = [];
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: fromCenter ? canvas.width / 2 : Math.random() * canvas.width,
        y: fromCenter ? canvas.height / 2 : -20 - Math.random() * canvas.height * 0.5,
        vx: fromCenter ? (Math.random() - 0.5) * 16 : (Math.random() - 0.5) * 8,
        vy: fromCenter ? (Math.random() - 0.5) * 16 - 4 : Math.random() * 3 + 2,
        width: Math.random() * 8 + 4,
        height: Math.random() * 6 + 3,
        color: palette[Math.floor(Math.random() * palette.length)],
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.15,
        shape: shapes[Math.floor(Math.random() * shapes.length)],
        opacity: 1,
        gravity: 0.12 + Math.random() * 0.08,
      });
    }

    const startTime = Date.now();
    let animationId = 0;
    const tick = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed > duration) {
        const fade = Math.min((elapsed - duration) / 1000, 1);
        if (fade >= 1) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          cancelAnimationFrame(animationId);
          return;
        }
        particles.forEach((p) => {
          p.opacity = 1 - fade;
        });
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.vy += p.gravity;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;
        p.x += Math.sin(elapsed * 0.002 + p.y * 0.01) * 0.5;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        switch (p.shape) {
          case "rect":
            ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
            break;
          case "circle":
            ctx.beginPath();
            ctx.arc(0, 0, p.width / 2, 0, Math.PI * 2);
            ctx.fill();
            break;
          case "strip":
            ctx.fillRect(-p.width / 2, -p.height, p.width * 0.4, p.height * 2.5);
            break;
        }
        ctx.restore();
      });

      animationId = requestAnimationFrame(tick);
    };
    animationId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", setSize);
    };
    // Props are intentionally captured at burst time (when fireKey changes); we
    // don't want a parent re-render mid-animation to restart the canvas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fireKey, prefersReduced]);

  if (prefersReduced) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 ${className}`}
      style={{ zIndex }}
    />
  );
}

export default Confetti;
