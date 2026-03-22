import Link from "next/link";

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--bg-base, #0a0f1a)" }}
    >
      <div className="max-w-md w-full text-center">
        <div
          className="text-[72px] font-bold mb-4"
          style={{
            fontFamily: "var(--font-display)",
            color: "rgba(45,212,191,0.15)",
          }}
        >
          404
        </div>

        <h1
          className="text-[24px] font-bold mb-3"
          style={{
            color: "var(--text-heading, #f1f5f9)",
            fontFamily: "var(--font-display)",
          }}
        >
          Page not found
        </h1>

        <p
          className="text-[16px] mb-8 leading-relaxed"
          style={{ color: "var(--text-secondary, #94a3b8)" }}
        >
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="px-6 py-3 font-semibold rounded-full text-[14px] transition-colors hover:brightness-110"
            style={{ background: "#2dd4bf", color: "#0a0f1a" }}
          >
            Back to home
          </Link>
          <Link
            href="/books"
            className="px-6 py-3 font-medium rounded-full text-[14px] transition-colors"
            style={{
              background: "rgba(255,255,255,0.04)",
              color: "var(--text-heading, #f1f5f9)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            Browse library
          </Link>
        </div>
      </div>
    </div>
  );
}
