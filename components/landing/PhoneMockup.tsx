"use client";

import { motion, useReducedMotion } from "framer-motion";
import { PhoneStatusBar } from "./PhoneStatusBar";
import { PhoneTabBar } from "./PhoneTabBar";

export function PhoneMockup({ children }: { children: React.ReactNode }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="relative flex justify-center">
      {/* Teal glow behind phone */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        style={{
          width: 300,
          height: 400,
          background:
            "radial-gradient(ellipse, rgba(45,212,191,0.06) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />

      {/* Float animation wrapper */}
      <motion.div
        className="relative"
        animate={prefersReducedMotion ? {} : { y: [0, -6, 0, 6, 0] }}
        transition={
          prefersReducedMotion
            ? {}
            : {
                duration: 5,
                ease: "easeInOut",
                repeat: Infinity,
              }
        }
      >
        {/* Live Demo badge */}
        <div className="flex items-center justify-center gap-1.5 mb-3">
          <span className="relative flex h-2 w-2">
            <span
              className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
              style={{ background: "var(--accent-green)" }}
            />
            <span
              className="relative inline-flex rounded-full h-2 w-2"
              style={{ background: "var(--accent-green)" }}
            />
          </span>
          <span
            className="text-[10px] font-semibold uppercase"
            style={{ color: "var(--accent-teal)", letterSpacing: "0.1em" }}
          >
            Live Demo
          </span>
        </div>

        {/* iPhone frame */}
        <div
          className="relative w-[250px] md:w-[290px]"
          style={{
            background:
              "linear-gradient(145deg, #3A3A3C 0%, #2C2C2E 30%, #1C1C1E 70%, #2A2A2C 100%)",
            borderRadius: 48,
            border: "1.5px solid rgba(255,255,255,0.12)",
            boxShadow: [
              "0 0 0 1px rgba(0,0,0,0.5)",
              "0 20px 60px rgba(0,0,0,0.5)",
              "inset 0 0 0 1.5px rgba(255,255,255,0.05)",
            ].join(", "),
            padding: 8,
          }}
        >
          {/* Side buttons */}
          {/* Power button - right */}
          <div
            className="absolute -right-[2px] rounded-sm"
            style={{
              top: "30%",
              width: 2,
              height: 40,
              background: "#3A3A3C",
            }}
          />
          {/* Mute switch - left */}
          <div
            className="absolute -left-[2px] rounded-sm"
            style={{
              top: "18%",
              width: 2,
              height: 16,
              background: "#3A3A3C",
            }}
          />
          {/* Volume up - left */}
          <div
            className="absolute -left-[2px] rounded-sm"
            style={{
              top: "25%",
              width: 2,
              height: 28,
              background: "#3A3A3C",
            }}
          />
          {/* Volume down - left */}
          <div
            className="absolute -left-[2px] rounded-sm"
            style={{
              top: "35%",
              width: 2,
              height: 28,
              background: "#3A3A3C",
            }}
          />

          {/* Screen */}
          <div
            className="relative w-full overflow-hidden"
            style={{
              background: "#08080C",
              borderRadius: 42,
              aspectRatio: "1 / 2.16",
            }}
          >
            <PhoneStatusBar />

            {/* Screen content area */}
            <div
              className="absolute inset-0"
              style={{
                paddingTop: 54,
                paddingBottom: 64,
              }}
            >
              {children}
            </div>

            <PhoneTabBar />

            {/* Glass reflection overlay */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "linear-gradient(135deg, transparent 40%, rgba(255,255,255,0.02) 50%, transparent 60%)",
                borderRadius: 42,
              }}
            />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
