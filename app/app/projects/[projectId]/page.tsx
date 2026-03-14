import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import ProjectDetailClient from "./ProjectDetailClient";
import type { FileRow } from "../_lib/types";
import { getServerOrigin } from "@/app/app/_lib/server-origin";
import {
  GUEST_PROJECT_ID,
  GUEST_SESSION_COOKIE,
} from "@/app/app/api/_lib/guest-session";
import { isDevAuthBypassEnabled } from "@/app/app/_lib/dev-auth-bypass";

type ProjectRow = {
  projectId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  status: string;
};

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

async function fetchProjects(): Promise<ProjectRow[]> {
  const origin = await getServerOrigin();
  const store = await cookies();
  const cookie = cookieHeaderFromStore(store);

  const res = await fetch(`${origin}/app/api/projects`, {
    method: "GET",
    headers: cookie ? { cookie } : {},
    cache: "no-store",
  });

  if (res.status === 401) return [];
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GET /app/api/projects failed: ${res.status} ${text}`);
  }

  const data = await readJsonIfPossible<{ projects?: ProjectRow[] }>(res);
  if (!data) return [];
  return data.projects ?? [];
}

async function fetchProjectFiles(projectId: string): Promise<FileRow[]> {
  const origin = await getServerOrigin();
  const store = await cookies();
  const cookie = cookieHeaderFromStore(store);

  const res = await fetch(
    `${origin}/app/api/projects/${encodeURIComponent(projectId)}/files`,
    {
      method: "GET",
      headers: cookie ? { cookie } : {},
      cache: "no-store",
    }
  );

  if (res.status === 401) return [];
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `GET /app/api/projects/${projectId}/files failed: ${res.status} ${text}`
    );
  }

  const data = await readJsonIfPossible<{ files?: FileRow[] }>(res);
  if (!data) return [];
  return data.files ?? [];
}

export default async function AppProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const jar = await cookies();
  const hasGuestSession = Boolean(jar.get(GUEST_SESSION_COOKIE)?.value);
  const isGuestProject = projectId === GUEST_PROJECT_ID;

  if (isGuestProject) {
    if (!hasGuestSession) redirect("/test");
    const initialFiles = await fetchProjectFiles(projectId);
    return (
      <ProjectDetailClient
        projectId={projectId}
        projectName="Guest Conversion Test"
        initialFiles={initialFiles}
        guestMode
      />
    );
  }

  // extra guard (proxy already does this)
  if (!isDevAuthBypassEnabled() && !jar.get("id_token")?.value) {
    redirect("/?auth=required");
  }

  const [projects, initialFiles] = await Promise.all([
    fetchProjects(),
    fetchProjectFiles(projectId),
  ]);

  const project = projects.find((p) => p.projectId === projectId);
  if (!project) redirect("/app/projects");

  return (
    <ProjectDetailClient
      projectId={projectId}
      projectName={project.name}
      initialFiles={initialFiles}
    />
  );
}
