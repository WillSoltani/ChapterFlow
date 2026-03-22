export function PhoneStatusBar() {
  return (
    <div
      className="absolute top-0 left-0 right-0 z-10 flex items-end justify-between"
      style={{ height: 50, padding: "0 20px 4px 20px" }}
    >
      {/* Time */}
      <span
        className="text-[12px] font-semibold"
        style={{ color: "var(--text-heading)" }}
      >
        9:41
      </span>

      {/* Dynamic Island */}
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          top: 8,
          width: 120,
          height: 34,
          background: "#000000",
          borderRadius: 20,
        }}
      />

      {/* Right icons: signal + wifi + battery */}
      <div className="flex items-center gap-1.5">
        {/* Signal bars */}
        <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
          <rect
            x="0"
            y="7"
            width="2"
            height="3"
            rx="0.5"
            fill="var(--text-heading)"
          />
          <rect
            x="3"
            y="5"
            width="2"
            height="5"
            rx="0.5"
            fill="var(--text-heading)"
          />
          <rect
            x="6"
            y="3"
            width="2"
            height="7"
            rx="0.5"
            fill="var(--text-heading)"
          />
          <rect
            x="9"
            y="0"
            width="2"
            height="10"
            rx="0.5"
            fill="var(--text-heading)"
          />
        </svg>

        {/* WiFi */}
        <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
          <path
            d="M6 9a1 1 0 100-2 1 1 0 000 2z"
            fill="var(--text-heading)"
          />
          <path
            d="M3.5 6.5a3.5 3.5 0 015 0"
            stroke="var(--text-heading)"
            strokeWidth="1.2"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M1.5 4.5a6 6 0 019 0"
            stroke="var(--text-heading)"
            strokeWidth="1.2"
            strokeLinecap="round"
            fill="none"
          />
        </svg>

        {/* Battery */}
        <svg width="20" height="10" viewBox="0 0 20 10" fill="none">
          <rect
            x="0"
            y="0.5"
            width="16"
            height="9"
            rx="2"
            stroke="var(--text-heading)"
            strokeWidth="1"
            fill="none"
          />
          <rect
            x="1.5"
            y="2"
            width="13"
            height="6"
            rx="1"
            fill="var(--text-heading)"
          />
          <rect
            x="17"
            y="3"
            width="2"
            height="4"
            rx="0.5"
            fill="var(--text-heading)"
            opacity="0.4"
          />
        </svg>
      </div>
    </div>
  );
}
