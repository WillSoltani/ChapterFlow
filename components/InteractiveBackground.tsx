"use client";

import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  baseAlpha: number;
  phase: number;
};

export function InteractiveBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const mouseRef = useRef({
    x: 0,
    y: 0,
    active: false,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const particles: Particle[] = [];
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

    const rand = (min: number, max: number) => min + Math.random() * (max - min);

    const getCount = (w: number, h: number) => {
      const area = w * h;
      const base = Math.floor(area / 18000);
      return Math.max(45, Math.min(110, base));
    };

    const setCanvasSize = () => {
      // Use viewport size. Do NOT use parent measurements.
      const w = window.innerWidth;
      const h = window.innerHeight;

      // Backing store size (DPR)
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);

      // CSS size
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      // Ensure drawing coordinates are in CSS pixels
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Adjust particles count (keep existing positions when possible)
      const target = getCount(w, h);
      if (particles.length < target) {
        for (let i = particles.length; i < target; i++) {
          particles.push({
            x: rand(0, w),
            y: rand(0, h),
            vx: rand(-0.18, 0.18),
            vy: rand(-0.18, 0.18),
            r: rand(0.8, 2.4),
            baseAlpha: rand(0.06, 0.16),
            phase: rand(0, Math.PI * 2),
          });
        }
      } else if (particles.length > target) {
        particles.splice(target);
      }
    };

    const initParticles = () => {
      particles.length = 0;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const count = getCount(w, h);

      for (let i = 0; i < count; i++) {
        particles.push({
          x: rand(0, w),
          y: rand(0, h),
          vx: rand(-0.18, 0.18),
          vy: rand(-0.18, 0.18),
          r: rand(0.8, 2.4),
          baseAlpha: rand(0.06, 0.16),
          phase: rand(0, Math.PI * 2),
        });
      }
    };

    const onMove = (e: PointerEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
      mouseRef.current.active = true;
    };

    const onLeave = () => {
      mouseRef.current.active = false;
    };

    const step = (t: number) => {
      const w = window.innerWidth;
      const h = window.innerHeight;

      ctx.clearRect(0, 0, w, h);

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      const repelRadius = 150;
      const repelStrength = 0.42;
      const linkDist = 120;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        p.x += p.vx;
        p.y += p.vy;

        // wrap
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10;
        if (p.y > h + 10) p.y = -10;

        if (mouseRef.current.active) {
          const dx = p.x - mx;
          const dy = p.y - my;
          const dist = Math.hypot(dx, dy);
          if (dist < repelRadius && dist > 0.001) {
            const push = (1 - dist / repelRadius) * repelStrength;
            p.vx += (dx / dist) * push * 0.06;
            p.vy += (dy / dist) * push * 0.06;
          }
        }

        // damping + clamp
        p.vx *= 0.985;
        p.vy *= 0.985;
        const maxV = 0.6;
        p.vx = Math.max(-maxV, Math.min(maxV, p.vx));
        p.vy = Math.max(-maxV, Math.min(maxV, p.vy));

        // pulse alpha
        const pulse = 0.5 + 0.5 * Math.sin(p.phase + t * 0.0012);
        const a = p.baseAlpha + pulse * 0.06;

        // dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(226,232,240,${a})`;
        ctx.fill();

        // links
        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j];
          const d = Math.hypot(p.x - q.x, p.y - q.y);
          if (d < linkDist) {
            const lineA = (1 - d / linkDist) * 0.08;
            ctx.strokeStyle = `rgba(56,189,248,${lineA})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.stroke();
          }
        }
      }

      rafRef.current = requestAnimationFrame(step);
    };

    setCanvasSize();
    initParticles();

    window.addEventListener("resize", setCanvasSize, { passive: true });
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave, { passive: true });

    rafRef.current = requestAnimationFrame(step);

    return () => {
      window.removeEventListener("resize", setCanvasSize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* base */}
      <div className="absolute inset-0 bg-[#070b16]" />

      {/* depth gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_50%_10%,rgba(56,189,248,0.16),transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(700px_circle_at_10%_40%,rgba(139,92,246,0.12),transparent_65%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_90%_70%,rgba(34,197,94,0.08),transparent_65%)]" />

      {/* particles canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 opacity-80"
        style={{ maxWidth: "100vw", maxHeight: "100vh" }}
      />

      {/* vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(1200px_circle_at_50%_40%,transparent_35%,rgba(0,0,0,0.62)_100%)]" />
    </div>
  );
}
