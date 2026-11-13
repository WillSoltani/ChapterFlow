/**
 * localStorage access that never throws. Safari with site data blocked,
 * locked-down browsers and a full quota throw on read or write; uncaught in an
 * effect that sends the reader to the error page. Writes that fail are kept
 * in memory for this page so the reader keeps working, just without saving
 * on this device.
 */

const memory = new Map<string, string>();

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage ?? null;
}

export function safeGetItem(key: string): string | null {
  if (memory.has(key)) return memory.get(key) ?? null;
  try {
    return storage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** Returns true when the value reached localStorage. */
export function safeSetItem(key: string, value: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const target = storage();
    if (!target) throw new Error("localStorage unavailable");
    target.setItem(key, value);
    memory.delete(key);
    return true;
  } catch {
    memory.set(key, value);
    return false;
  }
}

export function resetSafeStorageForTests(): void {
  memory.clear();
}
