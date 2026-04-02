export function performLogout() {
  window.location.assign(
    `/auth/logout?returnTo=${encodeURIComponent(window.location.origin)}`
  );
}
