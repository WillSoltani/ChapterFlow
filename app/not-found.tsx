import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--bg-base)" }}
    >
      <div className="max-w-md w-full text-center">
        <div className="flex justify-center mb-4">
          <AlertTriangle
            size={64}
            style={{ color: "var(--accent-amber)" }}
          />
        </div>

        <div
          className="text-[72px] font-bold mb-4"
          style={{
            fontFamily: "var(--font-display)",
            color: "rgba(245, 158, 11, 0.15)",
          }}
        >
          404
        </div>

        <h1
          className="text-[24px] font-bold mb-3"
          style={{
            color: "var(--text-heading)",
            fontFamily: "var(--font-display)",
          }}
        >
          Page not found
        </h1>

        <p
          className="text-[16px] mb-8 leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="px-6 py-3 font-semibold rounded-full text-[14px] transition-colors hover:brightness-110"
            style={{
              background: "var(--accent-amber)",
              color: "var(--bg-base)",
            }}
          >
            Back to home
          </Link>
          <Link
            href="/books"
            className="px-6 py-3 font-medium rounded-full text-[14px] transition-colors"
            style={{
              background: "var(--bg-surface-2)",
              color: "var(--text-heading)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            Browse library
          </Link>
        </div>
      </div>
    </div>
  );
}
