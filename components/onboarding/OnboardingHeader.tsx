"use client";

import { useRouter } from "next/navigation";

interface OnboardingHeaderProps {
  currentStep: 1 | 2 | 3;
}

export function OnboardingHeader({ currentStep }: OnboardingHeaderProps) {
  const router = useRouter();

  return (
    <header
      className="fixed top-[3px] left-0 right-0 z-40 flex items-center justify-between"
      style={{ padding: "16px 20px" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect
            x="3"
            y="2"
            width="14"
            height="20"
            rx="2"
            stroke="var(--accent-blue)"
            strokeWidth="1.5"
          />
          <path
            d="M7 7h6M7 11h6M7 15h4"
            stroke="var(--accent-blue)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <rect
            x="7"
            y="4"
            width="14"
            height="20"
            rx="2"
            fill="var(--bg-base)"
            stroke="var(--accent-blue)"
            strokeWidth="1.5"
          />
          <path
            d="M11 9h6M11 13h6M11 17h4"
            stroke="var(--accent-blue)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        <span
          style={{
            fontFamily: "var(--font-sora)",
            fontSize: 16,
            fontWeight: 600,
            color: "var(--text-heading)",
          }}
        >
          ChapterFlow
        </span>
      </div>

      {/* Skip setup — visible on steps 1 & 2 only */}
      {currentStep < 3 && (
        <button
          onClick={() => router.push("/dashboard")}
          className="cursor-pointer transition-colors duration-200"
          style={{
            fontFamily: "var(--font-dm-sans)",
            fontSize: 13,
            color: "var(--text-muted)",
            background: "none",
            border: "none",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.color = "var(--text-secondary)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.color = "var(--text-muted)")
          }
        >
          Skip setup
        </button>
      )}
    </header>
  );
}
