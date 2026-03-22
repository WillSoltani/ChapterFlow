function HomeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.5 7.5L9 2l6.5 5.5" />
      <path d="M4 6.5V15a1 1 0 001 1h3v-4h2v4h3a1 1 0 001-1V6.5" />
    </svg>
  );
}

function LibraryIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 4.5v11" />
      <path d="M9 4.5C7.5 3 5 2.5 3 3v10.5c2 -.5 4.5 0 6 1.5" />
      <path d="M9 4.5c1.5-1.5 4-2 6-1.5v10.5c-2-.5-4.5 0-6 1.5" />
    </svg>
  );
}

function ProgressIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="10" width="3.5" height="6" rx="0.75" />
      <rect x="7.25" y="6" width="3.5" height="10" rx="0.75" />
      <rect x="12.5" y="2" width="3.5" height="14" rx="0.75" />
    </svg>
  );
}

function BadgesIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 2l2.1 4.3 4.7.7-3.4 3.3.8 4.7L9 12.8 4.8 15l.8-4.7L2.2 7l4.7-.7L9 2z" />
    </svg>
  );
}

const tabs = [
  { label: "Home", active: true, icon: <HomeIcon /> },
  { label: "Library", active: false, icon: <LibraryIcon /> },
  { label: "Progress", active: false, icon: <ProgressIcon /> },
  { label: "Badges", active: false, icon: <BadgesIcon /> },
];

export function PhoneTabBar() {
  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-10 flex justify-around items-center"
      style={{
        height: 56,
        background: "rgba(8,8,12,0.92)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        paddingBottom: 8,
      }}
    >
      {tabs.map((tab) => (
        <div key={tab.label} className="flex flex-col items-center gap-0.5">
          <div
            style={{
              color: tab.active
                ? "var(--accent-blue)"
                : "var(--text-muted)",
            }}
          >
            {tab.icon}
          </div>
          <span
            className="text-[9px] font-medium"
            style={{
              color: tab.active
                ? "var(--accent-blue)"
                : "var(--text-muted)",
            }}
          >
            {tab.label}
          </span>
        </div>
      ))}

      {/* Home indicator */}
      <div
        className="absolute left-1/2 -translate-x-1/2"
        style={{
          bottom: 4,
          width: 100,
          height: 4,
          background: "rgba(255,255,255,0.2)",
          borderRadius: 9999,
        }}
      />
    </div>
  );
}
