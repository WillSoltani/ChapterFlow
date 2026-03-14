type Props = {
  children: string;
};

export function Chip({ children }: Props) {
  return (
    <span
      className="
        inline-flex items-center
        rounded-full
        border border-white/10
        bg-white/5
        px-2.5 py-0.5
        text-xs font-medium
        text-slate-200
        transition
        sm:px-3 sm:py-1
        hover:bg-white/10
      "
    >
      {children}
    </span>
  );
}
