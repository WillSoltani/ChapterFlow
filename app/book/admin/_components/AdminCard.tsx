import type { ReactNode } from "react";

export function AdminCard({
  title,
  description,
  action,
  children,
  className = "",
  variant = "panel",
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  variant?: "panel" | "muted" | "strong";
}) {
  const variantClass =
    variant === "muted" ? "cf-panel-muted" : variant === "strong" ? "cf-panel-strong" : "cf-panel";

  return (
    <section className={`${variantClass} rounded-2xl p-5 sm:p-6 ${className}`}>
      {(title || description || action) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title && (
              <h2 className="text-base font-semibold tracking-tight text-(--cf-text-1)">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-0.5 text-[12px] text-(--cf-text-3)">{description}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3 sm:mb-8">
      <div className="min-w-0">
        <h1 className="text-3xl font-semibold tracking-tight text-(--cf-text-1) sm:text-[32px]">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 text-[13px] text-(--cf-text-3) sm:text-sm">{description}</p>
        )}
      </div>
      {action && <div className="w-full min-w-0 sm:w-auto sm:shrink-0">{action}</div>}
    </header>
  );
}
