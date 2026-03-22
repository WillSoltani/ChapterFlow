"use client";

import Link from "next/link";

interface OutlinedCTAProps {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  className?: string;
}

export function OutlinedCTA({
  children,
  href,
  onClick,
  className = "",
}: OutlinedCTAProps) {
  const baseClasses = `inline-flex items-center gap-2 bg-transparent text-(--text-primary) text-[16px] font-semibold px-7 py-3.5 rounded-(--radius-md-val) border border-(--border-medium) transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] hover:bg-(--bg-glass-hover) hover:border-(--border-medium) cursor-pointer ${className}`;

  if (href) {
    return (
      <Link href={href} className={baseClasses} onClick={onClick}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" className={baseClasses} onClick={onClick}>
      {children}
    </button>
  );
}
