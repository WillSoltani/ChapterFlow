// Pure client-IP + coarse-network helpers (no server-only / no I/O) so they can
// be unit-tested. The server entrypoint is client-ip.ts, which re-exports these.
//
// Single source of truth so the free-unlock abuse throttle (abuse.ts), the
// referral same-network fraud check (referral-fraud.ts), and the book-start
// path (ensure-book-started.ts) all derive the client IP and the coarse network
// prefix identically.

// Trusted proxy hops (CloudFront, plus any edge layer) in front of this app.
// The real client IP is the X-Forwarded-For entry this many positions from the
// RIGHT — the one our own edge appended. Leftmost entries are client-supplied
// and MUST NOT be trusted: an attacker could rotate a fake leftmost token to
// mint a fresh fingerprint per request and defeat the velocity checks.
const TRUSTED_PROXY_HOPS = Number(process.env.RATE_LIMIT_TRUSTED_PROXY_HOPS) || 1;

export function readClientIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const chain = forwarded
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (chain.length > 0) {
      const idx = Math.max(0, chain.length - TRUSTED_PROXY_HOPS);
      return chain[idx] ?? chain[chain.length - 1];
    }
  }
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const cloudfrontViewer = req.headers.get("cloudfront-viewer-address")?.trim();
  if (cloudfrontViewer) {
    // cloudfront-viewer-address is "ip:port"; for IPv6 the address itself
    // contains colons, so strip only the final :port segment.
    const trimmedPort = cloudfrontViewer.replace(/:\d+$/, "").trim();
    if (trimmedPort) return trimmedPort;
  }
  return null;
}

// Expand a (possibly "::"-compressed) IPv6 to its full 8-group form so that
// compressed forms like "2001:db8::1" still yield a network prefix instead of
// being dropped. Returns null for anything that is not a well-formed IPv6
// literal. Group casing/leading zeros are preserved verbatim so an already-full
// address produces a stable prefix string.
function expandIpv6(ip: string): string[] | null {
  // Drop a zone id (e.g. fe80::1%eth0) before parsing.
  const bare = ip.split("%")[0] ?? ip;
  if (!/^[0-9a-fA-F:]+$/.test(bare) || (bare.match(/::/g)?.length ?? 0) > 1) {
    return null;
  }
  const [head, tail, extra] = bare.split("::");
  if (extra !== undefined) return null;
  const headGroups = head ? head.split(":") : [];
  const tailGroups = tail ? tail.split(":") : [];
  let groups: string[];
  if (bare.includes("::")) {
    const fill = 8 - headGroups.length - tailGroups.length;
    if (fill < 0) return null;
    groups = [...headGroups, ...Array(fill).fill("0"), ...tailGroups];
  } else {
    groups = headGroups;
  }
  if (groups.length !== 8) return null;
  if (groups.some((g) => !/^[0-9a-fA-F]{1,4}$/.test(g))) return null;
  return groups;
}

// Coarsen an IP to its /24 (IPv4) or /64 (IPv6) network prefix.
export function coarseNetworkPrefix(ip: string | null): string | null {
  if (!ip) return null;
  // IPv4-mapped IPv6 (e.g. ::ffff:203.0.113.7), common when an IPv4 client
  // reaches a dual-stack edge — coarsen the embedded IPv4 to its /24.
  const v4mapped = ip.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  const effective = v4mapped ? v4mapped[1] : ip;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(effective)) {
    const octets = effective.split(".");
    if (octets.length !== 4) return null;
    return `${octets[0]}.${octets[1]}.${octets[2]}.0/24`;
  }
  if (effective.includes(":")) {
    const groups = expandIpv6(effective);
    if (!groups) return null;
    return `${groups.slice(0, 4).join(":")}::/64`;
  }
  return null;
}
