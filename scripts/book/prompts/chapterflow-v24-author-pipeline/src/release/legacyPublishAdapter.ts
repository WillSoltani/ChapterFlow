import type { Result } from "../contracts/v4Core.js";
import type { BookPackageV21 } from "../types.js";

export type LegacyRemotePublishPorts = Readonly<{
  git: (operation: string) => unknown;
  registry: (operation: string) => unknown;
  network: (operation: string) => unknown;
  credential: (operation: string) => unknown;
}>;

export type LegacyPublishShadow = Readonly<{
  mode: "SHADOW";
  bookId: string;
  packageBytes: string;
  remoteActions: 0;
}>;

/**
 * Compatibility bridge only. It can compare/package in shadow, but has no
 * method that can invoke Git, registry, network, or credential ports.
 */
export class LegacyPublishAdapter {
  readonly #ports: LegacyRemotePublishPorts;

  constructor(ports: LegacyRemotePublishPorts) {
    this.#ports = ports;
  }

  shadow(bookPackage: BookPackageV21): Result<LegacyPublishShadow> {
    // Keep injected ports reachable for composition tests without granting this
    // compatibility adapter an execution route.
    void this.#ports;
    return {
      ok: true,
      value: {
        mode: "SHADOW",
        bookId: bookPackage.book.bookId,
        packageBytes: JSON.stringify(bookPackage),
        remoteActions: 0,
      },
    };
  }
}
