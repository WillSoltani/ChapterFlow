import { ScreenSummaryState } from "./ScreenSummaryState";
import { ScreenScenarioState } from "./ScreenScenarioState";
import { ScreenQuizState } from "./ScreenQuizState";

const screenStates = [ScreenSummaryState, ScreenScenarioState, ScreenQuizState];

export function LaptopScreen({
  activeState,
  screenBlur = 0,
}: {
  activeState: number;
  screenBlur?: number;
}) {
  return (
    <div
      className="relative w-full h-full"
      style={{
        filter: screenBlur > 0 ? `blur(${screenBlur}px)` : undefined,
      }}
    >
      {/* App chrome bar */}
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{
          background: "var(--bg-raised)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <div className="flex items-center gap-2">
          {/* Book cover mini */}
          <div
            className="shrink-0 flex items-center justify-center"
            style={{
              width: 28,
              height: 40,
              borderRadius: 4,
              background: "linear-gradient(135deg, #059669, #047857)",
            }}
          >
            <span className="text-white text-[4px] font-bold uppercase text-center leading-tight px-0.5">
              How to Win Friends
            </span>
          </div>
          <div>
            <p
              className="text-[10px] font-semibold"
              style={{
                color: "var(--text-heading)",
                fontFamily: "var(--font-display)",
              }}
            >
              Chapter 4: Be a Good Listener
            </p>
            <p
              className="text-[8px]"
              style={{ color: "var(--accent-blue)" }}
            >
              Dale Carnegie
            </p>
          </div>
        </div>
        <span
          className="text-[7px]"
          style={{ color: "var(--text-muted)" }}
        >
          Step {activeState + 1} of 4
        </span>
      </div>

      {/* 4-segment progress bar */}
      <div
        className="flex gap-0.5 px-4 py-1.5"
        style={{ background: "var(--bg-raised)" }}
      >
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex-1 rounded-full"
            style={{
              height: 3,
              background:
                i < activeState
                  ? "var(--accent-teal)"
                  : i === activeState
                    ? "var(--accent-blue)"
                    : "var(--bg-elevated)",
              transition: "background 0.3s",
            }}
          />
        ))}
      </div>

      {/* Content states */}
      <div className="relative" style={{ height: "calc(100% - 64px)" }}>
        {screenStates.map((Component, i) => (
          <div
            key={i}
            className="absolute inset-0"
            style={{
              opacity: activeState === i ? 1 : 0,
              transition: "opacity 0.4s ease",
              pointerEvents: activeState === i ? "auto" : "none",
            }}
          >
            <Component />
          </div>
        ))}
      </div>
    </div>
  );
}
