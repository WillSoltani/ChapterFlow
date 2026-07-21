import type { Result } from "../contracts/v4Core.js";
import {
  CanonicalPackageAdapter,
  type CanonicalReleaseRequest,
  type CanonicalReleaseResult,
} from "./canonicalPackageAdapter.js";

export type LegacyPromotionAuthority = Readonly<{
  activeUseCount: () => number;
  isEnabled: () => boolean;
  disable: () => void | Promise<void>;
  restore: () => void | Promise<void>;
}>;

export type LegacyPromotionAdapterOptions = Readonly<{
  canonicalRelease: CanonicalPackageAdapter;
  legacyAuthority: LegacyPromotionAuthority;
}>;

function failed<T>(code: string, message: string, retryable = false): Result<T> {
  return { ok: false, error: { code, message, retryable } };
}

/** Quiescent, one-book legacy-to-V4 authority cutover. */
export class LegacyPromotionAdapter {
  readonly #canonicalRelease: CanonicalPackageAdapter;
  readonly #legacyAuthority: LegacyPromotionAuthority;
  #inFlight = false;

  constructor(options: LegacyPromotionAdapterOptions) {
    this.#canonicalRelease = options.canonicalRelease;
    this.#legacyAuthority = options.legacyAuthority;
  }

  shadow(): Readonly<{ mode: "SHADOW"; legacyEnabled: boolean; activeUseCount: number }> {
    return {
      mode: "SHADOW",
      legacyEnabled: this.#legacyAuthority.isEnabled(),
      activeUseCount: this.#legacyAuthority.activeUseCount(),
    };
  }

  async cutoverFirstCandidate(request: CanonicalReleaseRequest): Promise<Result<CanonicalReleaseResult>> {
    if (request.expectedBookRevision !== 0) {
      return failed("CUTOVER_REVISION_INVALID", "first V4 cutover requires expected revision 0");
    }
    if (this.#inFlight) return failed("CUTOVER_IN_PROGRESS", "legacy cutover is already in progress", true);
    if (this.#legacyAuthority.activeUseCount() !== 0) {
      return failed("LEGACY_PROMOTER_ACTIVE", "legacy promoter has active uses");
    }
    if (!this.#legacyAuthority.isEnabled()) {
      return failed("LEGACY_AUTHORITY_UNAVAILABLE", "legacy promoter is not authoritative");
    }

    this.#inFlight = true;
    try {
      await this.#legacyAuthority.disable();
      if (this.#legacyAuthority.isEnabled()) {
        return failed("MIXED_PROMOTER", "legacy promoter remained enabled after disable");
      }
      const released = await this.#canonicalRelease.release(request);
      if (released.ok) return released;

      // Reconciliation errors can mean pointer commit happened. Never restore
      // legacy in that uncertain state: mixed authority would be worse.
      if (released.error.code !== "RECONCILIATION_REQUIRED") {
        await this.#legacyAuthority.restore();
        if (!this.#legacyAuthority.isEnabled()) {
          return failed("LEGACY_AUTHORITY_RESTORE_FAILED", "safe pre-commit failure did not restore legacy authority");
        }
      }
      return released;
    } catch (cause) {
      try {
        await this.#legacyAuthority.restore();
      } catch {
        return failed("LEGACY_AUTHORITY_RESTORE_FAILED", "cutover threw and legacy authority could not be restored");
      }
      return failed("CUTOVER_FAILED", cause instanceof Error ? cause.message : String(cause));
    } finally {
      this.#inFlight = false;
    }
  }
}
