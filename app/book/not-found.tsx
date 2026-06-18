import Link from "next/link";

// In-app 404 boundary for everything under /book/**. Next.js resolves the
// nearest not-found.tsx to the segment where notFound() is thrown, so this one
// file catches all /book notFound() calls (book detail + chapter pages) without
// touching any call site. It renders inside app/book/layout.tsx's BookProviders,
// so the --cf-* tokens (declared in app/globals.css, theme-aware) always resolve
// — mirroring the sibling app/book/error.tsx boundary, but token-only (no raw-hex
// fallbacks) so it themes correctly in light/dark/high-contrast and passes
// scan:style. CTAs stay inside the app; the root app/not-found.tsx still serves
// genuinely public bad URLs.
export default function BookNotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        backgroundColor: "var(--cf-page-bg)",
        color: "var(--cf-text-1)",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 480 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 12 }}>
          We couldn&apos;t find that page
        </h1>
        <p
          style={{
            fontSize: 15,
            color: "var(--cf-text-3)",
            lineHeight: 1.6,
            marginBottom: 32,
          }}
        >
          This book or chapter may have moved or is no longer available. Your
          progress and streak are safe.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <Link
            href="/dashboard"
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "12px 24px",
              borderRadius: 12,
              backgroundColor: "var(--cf-surface-muted)",
              border: "1px solid var(--cf-border)",
              color: "var(--cf-text-1)",
              fontSize: 14,
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Back to Dashboard
          </Link>
          <Link
            href="/book/library"
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "12px 24px",
              borderRadius: 12,
              backgroundColor: "var(--cf-surface-muted)",
              border: "1px solid var(--cf-border)",
              color: "var(--cf-text-1)",
              fontSize: 14,
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Browse library
          </Link>
        </div>
      </div>
    </div>
  );
}
