"use client";

export function LoginButton() {
  return (
    <button
      type="button"
      onClick={() =>
        window.location.assign(
          `/auth/login?returnTo=${encodeURIComponent(window.location.href)}`
        )
      }
      className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-text-primary hover:bg-white/15"
    >
      Log in
    </button>
  );
}
