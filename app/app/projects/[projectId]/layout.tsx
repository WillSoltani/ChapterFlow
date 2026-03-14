import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ProjectLayoutShell } from "./ProjectLayoutShell";
import { getServerOrigin } from "@/app/app/_lib/server-origin";
import {
  GUEST_PROJECT_ID,
  GUEST_SESSION_COOKIE,
} from "@/app/app/api/_lib/guest-session";

type ProjectRow = { projectId: string; name: string };
type FilesResponse = { files?: unknown[] };

function cookieHeaderFromStore(store: Awaited<ReturnType<typeof cookies>>) {
  const all = store.getAll();
  if (!all.length) return "";
  return all.map((c) => `${c.name}=${c.value}`).join("; ");
}

async function readJsonIfPossible<T>(res: Response): Promise<T | null> {
  const contentType = (res.headers.get("content-type") || "").toLowerCase();
  if (!contentType.includes("application/json")) return null;
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function fetchProjectName(projectId: string): Promise<string> {
  const origin = await getServerOrigin();
  const store = await cookies();
  const cookie = cookieHeaderFromStore(store);
  const res = await fetch(`${origin}/app/api/projects`, {
    method: "GET",
    headers: cookie ? { cookie } : {},
    cache: "no-store",
  });
  if (!res.ok) return "Untitled Project";
  const data = await readJsonIfPossible<{ projects?: ProjectRow[] }>(res);
  if (!data) return "Untitled Project";
  const project = (data.projects ?? []).find((p) => p.projectId === projectId);
  return project?.name ?? "Untitled Project";
}

async function fetchFileCount(projectId: string): Promise<number> {
  const origin = await getServerOrigin();
  const store = await cookies();
  const cookie = cookieHeaderFromStore(store);
  const res = await fetch(
    `${origin}/app/api/projects/${encodeURIComponent(projectId)}/files`,
    { method: "GET", headers: cookie ? { cookie } : {}, cache: "no-store" }
  );
  if (!res.ok) return 0;
  const data = await readJsonIfPossible<FilesResponse>(res);
  if (!data) return 0;
  return Array.isArray(data.files) ? data.files.length : 0;
}

export default async function ProjectLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const jar = await cookies();
  const isGuestProject = projectId === GUEST_PROJECT_ID;
  const hasGuestSession = Boolean(jar.get(GUEST_SESSION_COOKIE)?.value);

  if (isGuestProject && !hasGuestSession) redirect("/test");

  const [projectName, fileCount] = isGuestProject
    ? await Promise.all([Promise.resolve("Guest Conversion Test"), fetchFileCount(projectId)])
    : await Promise.all([fetchProjectName(projectId), fetchFileCount(projectId)]);

  return (
    <ProjectLayoutShell
      projectId={projectId}
      projectName={projectName}
      initialFileCount={fileCount}
      guestMode={isGuestProject}
    >
      {children}
    </ProjectLayoutShell>
  );
}
