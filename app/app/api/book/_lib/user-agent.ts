/**
 * Lightweight User-Agent parsing for analytics.
 * Extracts device type, browser name, and OS from the UA string.
 * No third-party dependencies — uses simple pattern matching.
 */

export type ParsedUserAgent = {
  deviceType: "mobile" | "tablet" | "desktop";
  browserName: string;
  osName: string;
};

const UNKNOWN = "Unknown";

export function parseUserAgent(uaString: string | null | undefined): ParsedUserAgent {
  if (!uaString) {
    return { deviceType: "desktop", browserName: UNKNOWN, osName: UNKNOWN };
  }

  return {
    deviceType: detectDeviceType(uaString),
    browserName: detectBrowser(uaString),
    osName: detectOS(uaString),
  };
}

/** Extract UA string from a Request object. */
export function getUserAgentFromRequest(req: Request): ParsedUserAgent {
  return parseUserAgent(req.headers.get("user-agent"));
}

// ─── Device type ──────────────────────────────────────────────────────────────

function detectDeviceType(ua: string): "mobile" | "tablet" | "desktop" {
  // Check tablet first (iPad, Android tablet, etc.)
  if (/iPad|Android(?!.*Mobile)|Tablet/i.test(ua)) return "tablet";
  // Then mobile
  if (/Mobile|iPhone|iPod|Android.*Mobile|webOS|BlackBerry|Opera Mini|IEMobile/i.test(ua)) return "mobile";
  return "desktop";
}

// ─── Browser ──────────────────────────────────────────────────────────────────

function detectBrowser(ua: string): string {
  // Order matters — check more specific patterns first
  if (/Edg\//i.test(ua)) return "Edge";
  if (/OPR\/|Opera/i.test(ua)) return "Opera";
  if (/Brave/i.test(ua)) return "Brave";
  if (/Vivaldi/i.test(ua)) return "Vivaldi";
  if (/SamsungBrowser/i.test(ua)) return "Samsung Internet";
  if (/Firefox\//i.test(ua)) return "Firefox";
  if (/CriOS/i.test(ua)) return "Chrome"; // Chrome on iOS
  if (/Chrome\//i.test(ua)) return "Chrome";
  if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) return "Safari";
  return UNKNOWN;
}

// ─── Operating system ─────────────────────────────────────────────────────────

function detectOS(ua: string): string {
  if (/Windows/i.test(ua)) return "Windows";
  if (/Macintosh|Mac OS X/i.test(ua)) return "macOS";
  if (/iPad|iPhone|iPod/i.test(ua)) return "iOS";
  if (/Android/i.test(ua)) return "Android";
  if (/CrOS/i.test(ua)) return "ChromeOS";
  if (/Linux/i.test(ua)) return "Linux";
  return UNKNOWN;
}
