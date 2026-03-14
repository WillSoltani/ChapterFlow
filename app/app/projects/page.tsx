import { cookies } from "next/headers";
import ProjectsClient from "./ProjectsClient";
import { getServerOrigin } from "@/app/app/_lib/server-origin";

type ProjectRow = {
  projectId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  status: string;
};

// What ProjectsClient expects
type ClientStats = {
  totalProjects: number;
  totalFiles: number;
  spaceSavedBytes: number;
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

function isProjectRow(x: unknown): x is ProjectRow {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.projectId === "string" &&
    typeof o.name === "string" &&
    typeof o.createdAt === "string" &&
    typeof o.updatedAt === "string" &&
    typeof o.status === "string"
  );
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

  if (!res.ok) {
    if (res.status === 401) return [];
    const text = await res.text();
    throw new Error(`GET /app/api/projects failed: ${res.status} ${text}`);
  }

  const data = await readJsonIfPossible<unknown>(res);
  if (!data) return [];
  const projectsUnknown = (data as { projects?: unknown }).projects;

  if (!Array.isArray(projectsUnknown)) return [];
  return projectsUnknown.filter(isProjectRow);
}

async function fetchStats(): Promise<ClientStats> {
  const origin = await getServerOrigin();
  const store = await cookies();
  const cookie = cookieHeaderFromStore(store);

  // If you don't actually have this route yet, either create it or return zeros.
  const res = await fetch(`${origin}/app/api/me/stats`, {
    method: "GET",
    headers: cookie ? { cookie } : {},
    cache: "no-store",
  });

  if (!res.ok) {
    if (res.status === 401) {
      return { totalProjects: 0, totalFiles: 0, spaceSavedBytes: 0 };
    }
    const text = await res.text();
    throw new Error(`GET /app/api/me/stats failed: ${res.status} ${text}`);
  }

  const data = await readJsonIfPossible<unknown>(res);
  if (!data) return { totalProjects: 0, totalFiles: 0, spaceSavedBytes: 0 };
  const o = (typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {}) as Record<
    string,
    unknown
  >;

  const totalProjects =
    typeof o.totalProjects === "number" && Number.isFinite(o.totalProjects) ? o.totalProjects : 0;

  // Your API might return filesConverted or totalFiles. Support both.
  const totalFilesRaw =
    typeof o.totalFiles === "number"
      ? o.totalFiles
      : typeof o.filesConverted === "number"
        ? o.filesConverted
        : 0;

  const totalFiles = Number.isFinite(totalFilesRaw) ? totalFilesRaw : 0;

  const spaceSavedBytes =
    typeof o.spaceSavedBytes === "number" && Number.isFinite(o.spaceSavedBytes) ? o.spaceSavedBytes : 0;

  return { totalProjects, totalFiles, spaceSavedBytes };
}

export default async function AppProjectsPage() {
  const [projects, stats] = await Promise.all([fetchProjects(), fetchStats()]);
  return <ProjectsClient initialProjects={projects} initialStats={stats} />;
}
