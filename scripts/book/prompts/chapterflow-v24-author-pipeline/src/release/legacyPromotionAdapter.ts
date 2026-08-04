import type { Result } from "../contracts/v4Core.js";
import {
  CanonicalPackageAdapter,
  type CanonicalReleaseRequest,
  type CanonicalReleaseResult,
} from "./canonicalPackageAdapter.js";

export type LegacyPromotionAuthority = Readonly<{
  activeUseCount: () => number;
  isEnabled: () => boolean;
  /** Atomically checks quiescence, disables legacy, and owns shared cutover. */
  beginCutover: () => Promise<Result<LegacyPromotionCutoverLease>>;
}>;

export type LegacyPromotionCutoverLease = Readonly<{
  finish: (resolution: "KEEP_DISABLED" | "RESTORE_LEGACY") => void | Promise<void>;
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
    const acquired = await this.#legacyAuthority.beginCutover();
    if (!acquired.ok) return acquired;
    const lease = acquired.value;
    try {
      if (this.#legacyAuthority.isEnabled()) {
        const current = await this.#canonicalRelease.readCurrent(request.bookId);
        const resolution = current.ok && current.value === null ? "RESTORE_LEGACY" : "KEEP_DISABLED";
        await lease.finish(resolution);
        if (resolution === "RESTORE_LEGACY" && !this.#legacyAuthority.isEnabled()) {
          return failed("LEGACY_AUTHORITY_RESTORE_FAILED", "mixed-promoter rollback did not restore legacy authority");
        }
        return failed("MIXED_PROMOTER", "legacy promoter remained enabled after disable");
      }
      const released = await this.#canonicalRelease.release(request);
      if (released.ok) {
        await lease.finish("KEEP_DISABLED");
        return released;
      }

      // Restore only after an actual CURRENT read proves no V4 pointer exists.
      // Exact or mismatched V4 authority both keep legacy disabled.
      const current = await this.#canonicalRelease.readCurrent(request.bookId);
      const resolution = current.ok && current.value === null ? "RESTORE_LEGACY" : "KEEP_DISABLED";
      await lease.finish(resolution);
      if (resolution === "RESTORE_LEGACY" && !this.#legacyAuthority.isEnabled()) {
        return failed("LEGACY_AUTHORITY_RESTORE_FAILED", "safe pre-commit failure did not restore legacy authority");
      }
      return released;
    } catch (cause) {
      try {
        const current = await this.#canonicalRelease.readCurrent(request.bookId);
        await lease.finish(current.ok && current.value === null ? "RESTORE_LEGACY" : "KEEP_DISABLED");
      } catch {
        return failed("LEGACY_AUTHORITY_RESTORE_FAILED", "cutover threw and shared authority could not be reconciled");
      }
      return failed("CUTOVER_FAILED", cause instanceof Error ? cause.message : String(cause));
    }
  }
}
