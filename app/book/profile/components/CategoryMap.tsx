"use client";



export function CategoryMap({
  explored,
  totalCategories,
  onCategoryClick,
}: {
  explored: { name: string; chapters: number }[];
  totalCategories: number;
  onCategoryClick?: (category: string) => void;
}) {
  // Clamp to >= 0: `explored` is derived from live per-book categories, so if it
  // ever exceeds `totalCategories` we must not render a negative "+N more".
  const remaining = Math.max(0, totalCategories - explored.length);
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-cf-caption uppercase tracking-[0.22em] text-(--cf-text-3)">
          Categories explored
        </p>
        <span className="text-xs text-(--cf-text-3)">
          {explored.length} of {totalCategories}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {explored.map((cat) => (
          <button
            key={cat.name}
            type="button"
            onClick={() => onCategoryClick?.(cat.name)}
            className="cf-chip cf-chip-active px-2.5 py-1 text-cf-caption transition hover:bg-accent-cyan/15"
          >
            {cat.name} · {cat.chapters}
          </button>
        ))}
        {remaining > 0 ? (
          <span className="px-2 py-1 text-cf-caption text-(--cf-text-3)">
            +{remaining} more to discover
          </span>
        ) : null}
      </div>
    </div>
  );
}
