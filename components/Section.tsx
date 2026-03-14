import type { ReactNode } from "react";

type Props = {
  id?: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
};

export function Section({ id, title, subtitle, children }: Props) {
  return (
    <section
      id={id}
      className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16 scroll-mt-24"
    >
      <div className="mb-6 sm:mb-8">
        <h2 className="text-2xl sm:text-3xl font-semibold text-slate-100">
          {title}
        </h2>

        {subtitle ? (
          <p className="mt-2 max-w-2xl text-sm sm:text-base text-slate-300">
            {subtitle}
          </p>
        ) : null}
      </div>

      {children}
    </section>
  );
}
