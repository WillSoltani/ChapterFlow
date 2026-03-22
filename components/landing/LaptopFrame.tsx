export function LaptopFrame({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      {/* Lid / Screen portion */}
      <div
        className="relative mx-auto"
        style={{
          background:
            "linear-gradient(180deg, #2A2A2E 0%, #1C1C1E 4%, #1C1C1E 100%)",
          borderRadius: "16px 16px 0 0",
          padding: "10px 10px 0 10px",
          boxShadow:
            "inset 0 0 0 1px rgba(255,255,255,0.08), 0 -1px 0 0 rgba(255,255,255,0.04)",
        }}
      >
        {/* Camera notch */}
        <div className="flex justify-center mb-1">
          <div
            className="rounded-full"
            style={{
              width: 6,
              height: 6,
              background: "radial-gradient(circle, #3A3A3E 40%, #2A2A2E 100%)",
              border: "1px solid #3A3A3E",
              boxShadow: "0 0 2px rgba(0,0,0,0.4)",
            }}
          />
        </div>

        {/* Screen bezel */}
        <div
          className="w-full overflow-hidden"
          style={{
            background: "var(--bg-base)",
            borderRadius: "8px 8px 0 0",
            aspectRatio: "16 / 10",
            boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.5)",
          }}
        >
          {children}
        </div>
      </div>

      {/* Base / Keyboard deck */}
      <div
        className="relative mx-auto"
        style={{
          width: "104%",
          marginLeft: "-2%",
          height: 12,
          background:
            "linear-gradient(180deg, #3A3A3E 0%, #2C2C2E 40%, #1C1C1E 100%)",
          borderRadius: "0 0 8px 8px",
          boxShadow:
            "0 2px 8px rgba(0,0,0,0.3), 0 1px 0 0 rgba(255,255,255,0.03) inset",
        }}
      >
        {/* Front notch / trackpad lip */}
        <div
          className="absolute left-1/2 -translate-x-1/2 top-0"
          style={{
            width: 80,
            height: 4,
            background:
              "linear-gradient(180deg, #1A1A1E 0%, #222226 100%)",
            borderRadius: "0 0 4px 4px",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
          }}
        />
      </div>

      {/* Subtle reflection on the desk surface */}
      <div
        className="mx-auto"
        style={{
          width: "90%",
          height: 6,
          background:
            "radial-gradient(ellipse at center, rgba(255,255,255,0.02) 0%, transparent 70%)",
          filter: "blur(2px)",
        }}
      />
    </div>
  );
}
