"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { FolderKanban, Clock, Sparkles } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import type { ProjectRow, Stats, MenuState } from "./_lib/types";

import { StatCard } from "./components/StatCard";
import { ProjectCard } from "./components/ProjectCard";
import { ProjectMenu } from "./components/ProjectMenu";
import { CreateProjectModal } from "./components/CreateProjectModal";

import { fmtBytes, getErrorMessage, parseCreatedProject, readErrorBody } from "./_lib/ui";

import { useViewportWidth } from "./hooks/useViewportWidth";
import { useCreateModalFromQuery } from "./hooks/useCreateModalFromQuery";
import { useEscapeClose } from "./hooks/useEscapeClose";
import { useProjectMeta } from "./hooks/useProjectMeta";

type Props = {
  initialProjects: ProjectRow[];
  initialStats: Stats;
};

export default function ProjectsClient({ initialProjects, initialStats }: Props) {
  const router = useRouter();
  const sp = useSearchParams();

  const [projects, setProjects] = useState<ProjectRow[]>(initialProjects);
  const [stats, setStats] = useState<Stats>(initialStats);

  const [menu, setMenu] = useState<MenuState>({ open: false });
  const [busyId, setBusyId] = useState<string | null>(null);

  // Create modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);

  const viewportW = useViewportWidth();

  // Keep state in sync if server refreshes
  useEffect(() => setProjects(initialProjects), [initialProjects]);
  useEffect(() => setStats(initialStats), [initialStats]);

  // Refetch stats client-side on every mount so "Space saved" is fresh after
  // navigating back from the conversion page (Next.js router cache may serve
  // a stale server render).
  useEffect(() => {
    fetch("/app/api/me/stats", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<Record<string, unknown>>) : null))
      .then((data) => {
        if (!data || typeof data !== "object") return;
        const totalProjects =
          typeof data.totalProjects === "number" ? data.totalProjects : undefined;
        const totalFiles =
          typeof data.filesConverted === "number"
            ? data.filesConverted
            : typeof data.totalFiles === "number"
              ? data.totalFiles
              : undefined;
        const spaceSavedBytes =
          typeof data.spaceSavedBytes === "number" ? data.spaceSavedBytes : undefined;
        setStats((prev) => ({
          totalProjects: totalProjects ?? prev.totalProjects,
          totalFiles: totalFiles ?? prev.totalFiles,
          spaceSavedBytes: spaceSavedBytes ?? prev.spaceSavedBytes,
        }));
      })
      .catch(() => {});
  }, []);

  // Open create modal if navigated from top bar: /app/projects?create=1
  useCreateModalFromQuery({ sp, router, open: setCreateOpen });

  const closeMenu = useCallback(() => setMenu({ open: false }), []);

  // Close menu/modal on Escape
  useEscapeClose({ closeMenu, closeCreate: () => setCreateOpen(false) });

  const sorted = useMemo(() => {
    const arr = [...projects];
    arr.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    return arr;
  }, [projects]);

  // Fetch file counts + latest activity per project
  const meta = useProjectMeta(projects);

  // --- Create Project ---
  async function createProject() {
    const name = createName.trim();
    if (!name || createBusy) return;

    setCreateBusy(true);
    setCreateErr(null);

    try {
      const res = await fetch("/app/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      const text = await res.text();
      if (!res.ok) throw new Error(text || `Create failed: ${res.status}`);

      const json = JSON.parse(text) as unknown;
      const created = parseCreatedProject(json);
      if (!created) throw new Error("Create succeeded but response shape was unexpected.");

      setProjects((prev) => [created, ...prev]);
      setStats((s) => ({ ...s, totalProjects: s.totalProjects + 1 }));

      setCreateName("");
      setCreateOpen(false);
      router.refresh();
    } catch (e: unknown) {
      setCreateErr(getErrorMessage(e).replace(/^Error:\s*/, ""));
    } finally {
      setCreateBusy(false);
    }
  }

  // --- Rename ---
  async function renameProject(projectId: string) {
    try {
      closeMenu();

      const current = projects.find((p) => p.projectId === projectId);
      const nextName = window.prompt("Rename project", current?.name ?? "");
      const name = (nextName ?? "").trim();
      if (!name) return;

      setBusyId(projectId);

      const res = await fetch(`/app/api/projects/${encodeURIComponent(projectId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (!res.ok) {
        const msg = await readErrorBody(res);
        throw new Error(msg || `Rename failed: ${res.status}`);
      }

      const now = new Date().toISOString();
      setProjects((prev) =>
        prev.map((p) => (p.projectId === projectId ? { ...p, name, updatedAt: now } : p))
      );

      router.refresh();
    } catch (e: unknown) {
      console.error(e);
      window.alert(`Rename failed: ${getErrorMessage(e)}`);
    } finally {
      setBusyId(null);
    }
  }

  // --- Delete ---
  async function deleteProject(projectId: string) {
    try {
      closeMenu();
      const ok = window.confirm("Delete this project? This cannot be undone.");
      if (!ok) return;

      setBusyId(projectId);

      const res = await fetch(`/app/api/projects/${encodeURIComponent(projectId)}`, {
        method: "DELETE",
      });

      if (res.status === 404) {
        setProjects((prev) => prev.filter((p) => p.projectId !== projectId));
        setStats((s) => ({ ...s, totalProjects: Math.max(0, s.totalProjects - 1) }));
        router.refresh();
        return;
      }

      if (!res.ok) {
        const msg = await readErrorBody(res);
        throw new Error(msg || `Delete failed: ${res.status}`);
      }

      setProjects((prev) => prev.filter((p) => p.projectId !== projectId));
      setStats((s) => ({ ...s, totalProjects: Math.max(0, s.totalProjects - 1) }));
      router.refresh();
    } catch (e: unknown) {
      console.error(e);
      window.alert(`Delete failed: ${getErrorMessage(e)}`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* Header / Stats */}
      <div className="space-y-4 sm:space-y-5">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Portfolio</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-100 sm:text-3xl">Serverless File Converter</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-300">
            Projects are isolated per-user. Uploads go direct-to-S3 via presigned URLs, metadata
            lives in DynamoDB, and outputs become artifacts.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard icon={<FolderKanban className="h-5 w-5" />} label="Total projects" value={String(stats.totalProjects)} />
          <StatCard icon={<Clock className="h-5 w-5" />} label="Files converted" value={String(stats.totalFiles)} />
          <StatCard icon={<Sparkles className="h-5 w-5" />} label="Space saved" value={fmtBytes(stats.spaceSavedBytes)} />
        </div>
      </div>

      {/* Projects grid */}
      <div className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-100">Your Projects</h2>
            <p className="mt-1 text-sm text-slate-300">Each project is a workspace. Hover a card for actions.</p>
          </div>
        </div>

        {sorted.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
            <p className="text-sm text-slate-300">No projects yet.</p>
            <p className="mt-2 text-xs text-slate-400">
              Click “New Project” in the top-right to create your first workspace.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
            {sorted.map((p) => (
              <ProjectCard
                key={p.projectId}
                project={p}
                busy={busyId === p.projectId}
                fileCount={meta[p.projectId]?.fileCount ?? 0}
                latestActivityAt={meta[p.projectId]?.latestActivityAt ?? p.updatedAt}
                onMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                  setMenu({ open: true, projectId: p.projectId, x: rect.right, y: rect.bottom });
                }}
              />
            ))}
          </div>
        )}
      </div>

      <ProjectMenu
        menu={menu}
        viewportW={viewportW}
        onClose={closeMenu}
        onRename={(id) => void renameProject(id)}
        onDelete={(id) => void deleteProject(id)}
      />

      <CreateProjectModal
        open={createOpen}
        name={createName}
        busy={createBusy}
        err={createErr}
        onClose={() => {
          setCreateOpen(false);
          setCreateErr(null);
        }}
        onNameChange={setCreateName}
        onCreate={() => void createProject()}
        onClear={() => {
          setCreateName("");
          setCreateErr(null);
        }}
      />
    </div>
  );
}
