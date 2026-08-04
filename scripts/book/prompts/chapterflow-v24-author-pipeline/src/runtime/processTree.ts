function processGroupExists(pid: number): boolean {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try {
    process.kill(process.platform === "win32" ? pid : -pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}

function signalProcessGroup(pid: number, signal: NodeJS.Signals): boolean {
  try {
    process.kill(process.platform === "win32" ? pid : -pid, signal);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "ESRCH";
  }
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((done) => setTimeout(done, milliseconds));
}

async function waitForProcessGroupExit(pid: number, maximumMs: number): Promise<boolean> {
  const deadline = Date.now() + maximumMs;
  while (processGroupExists(pid)) {
    if (Date.now() >= deadline) return false;
    await wait(5);
  }
  return true;
}

export function processTreeAlive(pid: number): boolean {
  return processGroupExists(pid);
}

/** POSIX uses a detached process group, so TERM/KILL reaches every descendant.
 * Windows lacks job objects in this package and can only signal root process. */
export async function terminateProcessTree(pid: number, graceMs: number): Promise<boolean> {
  if (!processGroupExists(pid)) return true;
  if (!signalProcessGroup(pid, "SIGTERM")) return false;
  if (await waitForProcessGroupExit(pid, graceMs)) return true;
  if (!signalProcessGroup(pid, "SIGKILL")) return false;
  return waitForProcessGroupExit(pid, Math.max(graceMs, 250));
}
