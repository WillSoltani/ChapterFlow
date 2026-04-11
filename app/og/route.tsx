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
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#070b16",
          backgroundImage:
            "radial-gradient(ellipse 60% 50% at 30% 0%, rgba(34, 211, 238, 0.12), transparent), radial-gradient(ellipse 40% 40% at 80% 60%, rgba(34, 211, 238, 0.06), transparent)",
        }}
      >
        <div
          style={{
            fontSize: 120,
            fontWeight: 800,
            color: "#22d3ee",
            letterSpacing: "-0.04em",
            lineHeight: 1,
          }}
        >
          ChapterFlow
        </div>
        <div
          style={{
            fontSize: 44,
            color: "#ffffff",
            marginTop: 24,
            opacity: 0.92,
            fontWeight: 600,
          }}
        >
          Stop forgetting what you read.
        </div>
        <div
          style={{
            fontSize: 22,
            color: "#22d3ee",
            marginTop: 36,
            opacity: 0.75,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          Built on spaced repetition science
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
