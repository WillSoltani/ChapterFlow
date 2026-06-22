import { ImageResponse } from "next/og";

export const runtime = "nodejs";

/**
 * Dynamic Open Graph image for ChapterFlow.
 *
 * Renders a 1200x630 PNG server-side from JSX so we don't need to ship a
 * binary asset. Referenced by OpenGraph metadata in app/page.tsx and
 * app/layout.tsx as `/og`.
 */
export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#06070A",
          backgroundImage:
            "radial-gradient(ellipse 55% 45% at 20% 0%, rgba(138, 162, 255, 0.10), transparent)",
        }}
      >
        <div
          style={{
            // Satori does NOT auto-wrap a nowrap flex row, so the single-line
            // headline could overflow the 1200px frame and shear off both edges.
            // Allow wrapping + cap the width so it breaks to two centered lines.
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            textAlign: "center",
            maxWidth: 1040,
            fontSize: 92,
            fontWeight: 800,
            letterSpacing: "-0.04em",
            lineHeight: 1.05,
            color: "#ECEFF6",
          }}
        >
          <span>Stop forgetting&nbsp;</span>
          <span style={{ color: "#8AA2FF" }}>what you read.</span>
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 26,
            color: "#A2A9BC",
            marginTop: 36,
            letterSpacing: "0.04em",
          }}
        >
          Guided reading on FSRS spaced repetition.
        </div>

        {/* Minimal periwinkle retention-curve motif near the bottom. */}
        <svg
          width={1200}
          height={120}
          viewBox="0 0 1200 120"
          style={{ position: "absolute", left: 0, bottom: 0 }}
        >
          <path
            d="M0 30 C 220 30, 300 105, 1200 112"
            fill="none"
            stroke="#8AA2FF"
            strokeWidth={3}
            strokeOpacity={0.45}
            strokeLinecap="round"
          />
        </svg>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
