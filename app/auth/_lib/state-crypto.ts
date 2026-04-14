import "server-only";

/**
 * Encrypts and decrypts OAuth state parameters using AES-256-GCM.
 *
 * This allows the PKCE verifier and returnTo URL to be carried inside the
 * `state` query parameter (which Cognito echoes back), rather than relying
 * on cookies that may not survive the redirect chain in some browsers.
 */

export type StatePayload = {
  /** PKCE code verifier */
  v: string;
  /** Post-auth redirect target */
  r: string;
  /** Random nonce (CSRF replacement) */
  n: string;
  /** Acquisition: HTTP referer at login start */
  ref?: string;
  /** Acquisition: utm_source */
  us?: string;
  /** Acquisition: utm_medium */
  um?: string;
  /** Acquisition: utm_campaign */
  uc?: string;
};

// ── Key derivation ──────────────────────────────────────────────────

let cachedKey: CryptoKey | null = null;

function getSecret(): string {
  const secret = process.env.AUTH_STATE_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_STATE_SECRET must be set and at least 32 characters long",
    );
  }
  return secret;
}

async function getKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;

  const secret = getSecret();
  const raw = new TextEncoder().encode(secret);

  // Import as HKDF key material, then derive AES-GCM key
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    raw,
    "HKDF",
    false,
    ["deriveKey"],
  );

  cachedKey = await crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new TextEncoder().encode("chapterflow-oauth-state-v1"),
      info: new TextEncoder().encode("aes-gcm-key"),
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );

  return cachedKey;
}

// ── Helpers ─────────────────────────────────────────────────────────

function base64UrlEncode(bytes: Uint8Array): string {
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  const b64 = btoa(str);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Encrypt a state payload into a URL-safe string.
 * Format: base64url(iv ‖ ciphertext ‖ tag)
 * AES-GCM uses a 12-byte IV; the tag is appended by SubtleCrypto.
 */
export async function encryptState(
  payload: StatePayload,
): Promise<string | null> {
  try {
    const key = await getKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode(JSON.stringify(payload));

    const ciphertext = new Uint8Array(
      await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext),
    );

    // Concatenate iv + ciphertext (which includes the GCM tag)
    const combined = new Uint8Array(iv.length + ciphertext.length);
    combined.set(iv, 0);
    combined.set(ciphertext, iv.length);

    return base64UrlEncode(combined);
  } catch {
    // AUTH_STATE_SECRET not configured — caller should fall back to
    // cookie-only mode.
    return null;
  }
}

/**
 * Decrypt a state string back into a payload.
 * Returns null if decryption fails (tampered, wrong key, corrupted).
 */
export async function decryptState(
  encrypted: string,
): Promise<StatePayload | null> {
  try {
    const key = await getKey();
    const combined = base64UrlDecode(encrypted);

    if (combined.length < 13) return null; // 12-byte IV + at least 1 byte

    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    const plaintext = new Uint8Array(
      await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext),
    );

    const parsed = JSON.parse(new TextDecoder().decode(plaintext));

    // Validate shape (only required fields)
    if (
      typeof parsed.v !== "string" ||
      typeof parsed.r !== "string" ||
      typeof parsed.n !== "string"
    ) {
      return null;
    }

    // Optional acquisition fields — pass through if present
    return parsed as StatePayload;
  } catch {
    return null;
  }
}
