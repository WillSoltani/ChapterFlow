import { cn } from "@/app/book/components/ui/cn";

type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  body?: string;
  align?: "left" | "center";
};

export function SectionHeading({
  eyebrow,
  title,
  body,
  align = "left",
}: SectionHeadingProps) {
  const centered = align === "center";

  return (
    <div className={cn("max-w-3xl", centered && "mx-auto text-center")}>
      <p className="text-xs uppercase tracking-[0.28em] text-cyan-100/72">{eyebrow}</p>
      <h2 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-slate-50 sm:text-5xl">
        {title}
      </h2>
      {body ? (
        <p className="mt-4 text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
          {body}
        </p>
      ) : null}
    </div>
  );
}
