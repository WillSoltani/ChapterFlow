interface PricingCardProps {
  name: string;
  price: string;
  period?: string;
  description: string;
  cta: string;
  isPrimary?: boolean;
  badge?: string;
  features: string[];
  missing: string[];
}

function CheckIcon() {
  return (
    <span
      className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center"
      style={{ backgroundColor: "var(--accent-green)" }}
    >
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path
          d="M2.5 5L4.5 7L7.5 3"
          stroke="white"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function DashIcon() {
  return (
    <span
      className="flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center"
      style={{ backgroundColor: "rgba(90, 90, 110, 0.2)" }}
    >
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path
          d="M3 5H7"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          className="text-(--text-muted)"
        />
      </svg>
    </span>
  );
}

export function PricingCard({
  name,
  price,
  period,
  description,
  cta,
  isPrimary = false,
  badge,
  features,
  missing,
}: PricingCardProps) {
  return (
    <div
      className="glass-card p-8 w-full max-w-[380px] relative"
      style={
        isPrimary
          ? {
              borderColor: "rgba(79,139,255,0.25)",
              boxShadow: "0 0 30px var(--glow-blue)",
            }
          : undefined
      }
    >
      {/* Badge */}
      {badge && (
        <span
          className="absolute -top-3.5 right-5 text-white text-[12px] font-semibold px-3.5 py-1 rounded-full shadow-lg"
          style={{ backgroundColor: "var(--accent-green)" }}
        >
          {badge}
        </span>
      )}

      {/* Tier label */}
      <span
        className={`text-[12px] uppercase tracking-[0.1em] font-semibold ${
          isPrimary ? "text-(--accent-blue)" : "text-(--text-secondary)"
        }`}
      >
        {name}
      </span>

      {/* Price */}
      <div className="mt-3 flex items-baseline">
        <span
          className="text-[48px] font-bold text-(--text-heading)"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        >
          {price}
        </span>
        {period && (
          <span className="text-[16px] text-(--text-muted) ml-1">{period}</span>
        )}
      </div>

      {/* Description */}
      <p className="text-[14px] text-(--text-secondary) mt-1">{description}</p>

      {/* Divider */}
      <hr
        className="my-6"
        style={{ borderColor: "var(--border-subtle)", borderWidth: "1px 0 0 0" }}
      />

      {/* Feature list */}
      <ul className="flex flex-col gap-3">
        {features.map((feature) => (
          <li key={feature} className="flex items-center gap-2.5 text-[14px] text-(--text-primary)">
            <CheckIcon />
            {feature}
          </li>
        ))}
        {missing.map((feature) => (
          <li key={feature} className="flex items-center gap-2.5 text-[14px] text-(--text-muted)">
            <DashIcon />
            {feature}
          </li>
        ))}
      </ul>

      {/* CTA button */}
      {isPrimary ? (
        <button
          type="button"
          className="mt-7 w-full text-white font-semibold py-3.5 transition-all duration-300 cursor-pointer hover:scale-[1.02]"
          style={{
            backgroundColor: "var(--accent-green)",
            borderRadius: "var(--radius-md-val)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--accent-green-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "var(--accent-green)";
          }}
        >
          {cta}
        </button>
      ) : (
        <button
          type="button"
          className="mt-7 w-full bg-transparent text-(--text-heading) font-semibold py-3.5 border border-(--border-medium) transition-all duration-300 cursor-pointer"
          style={{ borderRadius: "var(--radius-md-val)" }}
        >
          {cta}
        </button>
      )}

      {/* Pro fine print */}
      {isPrimary && (
        <p className="text-[12px] text-(--text-muted) text-center mt-2">
          No credit card required. Cancel before 14 days and you will never be
          charged.
        </p>
      )}
    </div>
  );
}
