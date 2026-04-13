import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

const VALID_TYPES = new Set(["chapter", "badge", "streak", "book"]);

function clamp(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) + "…" : value;
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const rawType = searchParams.get("type") ?? "chapter";
  const type = VALID_TYPES.has(rawType) ? rawType : "chapter";

  const bookTitle = clamp(searchParams.get("bookTitle") ?? "ChapterFlow", 120);
  const author = clamp(searchParams.get("author") ?? "", 80);
  const chapter = searchParams.get("chapter") ?? "";
  const takeaway = clamp(searchParams.get("takeaway") ?? "", 300);
  const userName = clamp(searchParams.get("userName") ?? "A ChapterFlow Reader", 60);
  const badgeName = clamp(searchParams.get("badgeName") ?? "", 80);
  const rawStreak = searchParams.get("streakDays") ?? "";
  const streakDays = /^\d+$/.test(rawStreak) ? rawStreak : "";
  const referralCode = searchParams.get("ref") ?? "";

  const siteHost = (() => {
    try {
      return new URL(
        process.env.CHAPTERFLOW_SITE_BASE_URL ||
          process.env.NEXT_PUBLIC_CHAPTERFLOW_SITE_URL ||
          "https://chapterflow.ca",
      ).host;
    } catch {
      return "chapterflow.ca";
    }
  })();

  const brandUrl = referralCode
    ? `${siteHost}/ref/${referralCode}`
    : siteHost;

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#070b16",
          padding: "60px",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Content area */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          {/* Type label */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: "#22d3ee",
              fontSize: "14px",
              fontWeight: 700,
              textTransform: "uppercase" as const,
              letterSpacing: "0.15em",
            }}
          >
            {type === "chapter" && "Chapter Completed"}
            {type === "badge" && "Badge Earned"}
            {type === "streak" && "Streak Milestone"}
            {type === "book" && "Book Completed"}
          </div>

          {/* Main content */}
          {type === "chapter" && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                marginTop: "24px",
              }}
            >
              {takeaway ? (
                <div
                  style={{
                    fontSize: "32px",
                    fontWeight: 600,
                    color: "#ffffff",
                    lineHeight: 1.4,
                    maxHeight: "200px",
                    overflow: "hidden",
                  }}
                >
                  &ldquo;{takeaway}&rdquo;
                </div>
              ) : (
                <div
                  style={{
                    fontSize: "40px",
                    fontWeight: 700,
                    color: "#ffffff",
                  }}
                >
                  {bookTitle}
                </div>
              )}
              <div
                style={{
                  marginTop: "20px",
                  fontSize: "18px",
                  color: "#94a3b8",
                }}
              >
                {takeaway ? bookTitle : ""} {chapter ? `${takeaway ? "· " : ""}Ch. ${chapter}` : ""}
              </div>
              {author && (
                <div style={{ fontSize: "16px", color: "#64748b", marginTop: "4px" }}>
                  by {author}
                </div>
              )}
            </div>
          )}

          {type === "badge" && (
            <div style={{ display: "flex", flexDirection: "column", marginTop: "24px" }}>
              <div style={{ fontSize: "48px", fontWeight: 700, color: "#ffffff" }}>
                {badgeName}
              </div>
              <div style={{ fontSize: "20px", color: "#94a3b8", marginTop: "12px" }}>
                Earned by {userName}
              </div>
            </div>
          )}

          {type === "streak" && (
            <div style={{ display: "flex", flexDirection: "column", marginTop: "24px" }}>
              <div style={{ fontSize: "72px", fontWeight: 800, color: "#22d3ee" }}>
                {streakDays} Days
              </div>
              <div style={{ fontSize: "24px", color: "#94a3b8", marginTop: "8px" }}>
                Reading streak by {userName}
              </div>
            </div>
          )}

          {type === "book" && (
            <div style={{ display: "flex", flexDirection: "column", marginTop: "24px" }}>
              <div style={{ fontSize: "40px", fontWeight: 700, color: "#ffffff" }}>
                {bookTitle}
              </div>
              <div style={{ fontSize: "20px", color: "#94a3b8", marginTop: "8px" }}>
                Completed by {userName}
              </div>
              {author && (
                <div style={{ fontSize: "18px", color: "#64748b", marginTop: "4px" }}>
                  by {author}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Branding bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: "1px solid #1e293b",
            paddingTop: "20px",
          }}
        >
          <div style={{ fontSize: "20px", fontWeight: 700, color: "#22d3ee" }}>
            ChapterFlow
          </div>
          <div style={{ fontSize: "16px", color: "#64748b" }}>
            {brandUrl}
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "Cache-Control": "public, max-age=604800, s-maxage=604800, stale-while-revalidate=86400",
      },
    },
  );
}
