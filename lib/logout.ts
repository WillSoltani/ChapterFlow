import { clearLocalUserData } from "@/lib/client/local-user-data";

export function performLogout() {
  // ACCT-05: the next person to sign in on this browser must not inherit (and
  // then save into their account) this account's locally stored data.
  clearLocalUserData();
  window.location.assign(
    `/auth/logout?returnTo=${encodeURIComponent(window.location.origin)}`
  );
}
