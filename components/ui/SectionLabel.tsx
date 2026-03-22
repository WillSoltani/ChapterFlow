interface SectionLabelProps {
  children: React.ReactNode;
  className?: string;
}

export function SectionLabel({ children, className = "" }: SectionLabelProps) {
  return (
    <span
      className={`text-[0.75rem] font-semibold uppercase tracking-[0.15em] text-(--accent-teal) font-(family-name:--font-display) ${className}`}
    >
      {children}
    </span>
  );
}
