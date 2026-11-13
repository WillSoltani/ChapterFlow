import Link from "next/link";

/** PROG-26: shown where reading time would be, when Settings turned "Save reading history" off. */
export function ReadingHistoryOffNote({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs ${className}`} style={{ color: "var(--text-muted)" }}>
      Reading history is off ·{" "}
      <Link href="/book/settings" className="underline underline-offset-2" style={{ color: "var(--accent-cyan)" }}>
        turn it on in Settings
      </Link>
    </p>
  );
}
