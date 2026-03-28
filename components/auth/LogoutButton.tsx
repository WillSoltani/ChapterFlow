"use client";

export function LogoutButton() {
  const logout = () => {
    window.location.assign(
      `/auth/logout?returnTo=${encodeURIComponent(window.location.origin)}`
    );
  };

  return (
    <button
      type="button"
      onClick={logout}
      className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-text-primary hover:bg-white/15"
    >
      Log out
    </button>
  );
}
