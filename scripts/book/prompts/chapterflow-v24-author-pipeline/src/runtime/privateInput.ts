import type { Writable } from "node:stream";

/** Write private prompt bytes only to child stdin. Callers never receive a
 * string form that could be appended to argv or diagnostics. */
export function writePrivateInput(stream: Writable, bytes: Uint8Array): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error): void => {
      if (settled) return;
      settled = true;
      stream.off("error", onError);
      if (error) reject(error);
      else resolve();
    };
    const onError = (error: Error): void => finish(error);
    stream.once("error", onError);
    stream.end(Buffer.from(bytes), () => finish());
  });
}
