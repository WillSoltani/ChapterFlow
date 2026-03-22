"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

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

const COLORS = [
  "#3ECFB2", // teal
  "#5B8DEF", // blue
  "#E8B931", // gold
  "#FF8C42", // amber
  "#7C6BF0", // purple
  "#3BD4A0", // green
  "#FFFFFF", // white
];

interface CanvasConfettiProps {
  particleCount?: number;
  duration?: number;
}

export default function CanvasConfetti({
  particleCount = 100,
  duration = 3500,
}: CanvasConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    const particles: Particle[] = [];
    const shapes: Particle["shape"][] = ["rect", "circle", "strip"];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * canvas.height * 0.5,
        vx: (Math.random() - 0.5) * 8,
        vy: Math.random() * 3 + 2,
        width: Math.random() * 8 + 4,
        height: Math.random() * 6 + 3,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.15,
        shape: shapes[Math.floor(Math.random() * shapes.length)],
        opacity: 1,
        gravity: 0.12 + Math.random() * 0.08,
      });
    }

    const startTime = Date.now();
    let animationId: number;

    const animate = () => {
      const elapsed = Date.now() - startTime;

      if (elapsed > duration) {
        const fadeProgress = Math.min((elapsed - duration) / 1000, 1);
        if (fadeProgress >= 1) {
          cancelAnimationFrame(animationId);
          return;
        }
        particles.forEach((p) => {
          p.opacity = 1 - fadeProgress;
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
            ctx.fillRect(
              -p.width / 2,
              -p.height,
              p.width * 0.4,
              p.height * 2.5
            );
            break;
        }

        ctx.restore();
      });

      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", handleResize);
    };
  }, [prefersReducedMotion, particleCount, duration]);

  if (prefersReducedMotion) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50"
      style={{ mixBlendMode: "screen" }}
    />
  );
}
