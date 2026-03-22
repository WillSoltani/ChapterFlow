"use client";

import { useState } from "react";
import { LaptopFrame } from "./LaptopFrame";
import { LaptopScreen } from "./LaptopScreen";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { GreenCTA } from "@/components/ui/GreenCTA";

const TABS = ["Summary", "Scenario", "Quiz"] as const;

export function LaptopShowcaseMobile() {
  const [activeState, setActiveState] = useState(0);

  return (
    <section className="py-16 px-4">
      {/* Heading */}
      <div className="text-center mb-8">
        <SectionLabel>SEE IT IN ACTION</SectionLabel>
        <h2
          className="mt-3 text-[26px] font-bold leading-[1.1] tracking-[-0.02em]"
          style={{
            fontFamily: "var(--font-display)",
            color: "var(--text-heading)",
          }}
        >
          This is what reading looks like on ChapterFlow.
        </h2>
        <p
          className="mt-2 text-[14px] max-w-[400px] mx-auto"
          style={{
            fontFamily: "var(--font-body)",
            color: "var(--text-secondary)",
          }}
        >
          Summary. Scenario. Quiz. Unlock. Every chapter, every book.
        </p>
      </div>

      {/* Laptop at static final size */}
      <div className="max-w-[500px] mx-auto">
        <LaptopFrame>
          <LaptopScreen activeState={activeState} />
        </LaptopFrame>
      </div>

      {/* Tab buttons */}
      <div className="flex justify-center gap-2 mt-6">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveState(i)}
            className="px-4 py-2 rounded-full text-[13px] font-medium transition-all duration-200 cursor-pointer"
            style={{
              background:
                activeState === i
                  ? "var(--accent-blue)"
                  : "var(--bg-elevated)",
              color: activeState === i ? "white" : "var(--text-secondary)",
              border:
                activeState === i
                  ? "1px solid var(--accent-blue)"
                  : "1px solid var(--border-subtle)",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* CTA */}
      <div className="flex justify-center mt-6">
        <GreenCTA href="/auth/login?returnTo=%2Fbook">Start reading free</GreenCTA>
      </div>
    </section>
  );
}
