"use client";

import Link from "next/link";

interface GreenCTAProps {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  className?: string;
}

export function GreenCTA({
  children,
  href,
  onClick,
  className = "",
}: GreenCTAProps) {
  const baseClasses = `cta-shine inline-flex items-center gap-2 bg-(--accent-green) text-white text-[16px] font-semibold px-7 py-3.5 rounded-(--radius-md-val) transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-(--accent-green-hover) hover:scale-[1.03] hover:shadow-[0_0_20px_var(--glow-green)] cursor-pointer ${className}`;

  const arrow = (
    <span className="inline-block transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] group-hover:translate-x-1">
      &rarr;
    </span>
  );

  if (href) {
    return (
      <Link href={href} className={`group ${baseClasses}`} onClick={onClick}>
        {children}
        {arrow}
      </Link>
    );
  }

  return (
    <button type="button" className={`group ${baseClasses}`} onClick={onClick}>
      {children}
      {arrow}
    </button>
  );
}
