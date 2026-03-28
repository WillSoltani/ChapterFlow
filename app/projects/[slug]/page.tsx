// /app/projects/[slug]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import * as React from "react";
import Image from "next/image";


import {
  ArrowLeft,
  Github,
  ExternalLink,
  AlertTriangle,
  Lightbulb,
  Cloud,
  CheckCircle2,
  Shield,
  Activity,
  DollarSign,
  Sparkles,
} from "lucide-react";

import { projects } from "@/content/projects";
import type { Project } from "@/types/project";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/Chip";

/* -------------------------------------------------
   Data lookup
-------------------------------------------------- */

function getProjectBySlug(slug: string): Project | undefined {
  return projects.find((p) => p.slug === slug);
}

/* -------------------------------------------------
   Next metadata (params is a Promise in newer Next)
-------------------------------------------------- */

type ParamsPromise = Promise<{ slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: ParamsPromise;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = getProjectBySlug(slug);

  if (!project) return { title: "Project not found" };

  return {
    title: `${project.title} | Case Study`,
    description: project.description,
  };
}

/* -------------------------------------------------
   Small presentational helpers
-------------------------------------------------- */

function cn(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

function SectionHeader(props: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5">
        {props.icon}
      </div>
      <div className="min-w-0">
        <h2 className="text-xl font-semibold text-text-heading">{props.title}</h2>
        {props.subtitle ? (
          <p className="mt-1 text-sm text-text-secondary">{props.subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}

function SoftCard(props: { children: React.ReactNode; className?: string }) {
  return (
    <Card
      className={cn(
        "rounded-2xl border-white/10 bg-white/5 backdrop-blur",
        "shadow-[0_10px_40px_rgba(0,0,0,0.25)]",
        props.className
      )}
    >
      {props.children}
    </Card>
  );
}

function Pill(props: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs",
        props.className
      )}
    >
      <span className="text-text-secondary">{props.label}</span>
      <span className="text-text-primary">{props.value}</span>
    </div>
  );
}

function ServiceTile(props: { name: string }) {
  return (
    <div className="group rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur transition hover:bg-white/7">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-sm text-amber-200">
          {props.name}
        </span>
        <span className="text-xs text-text-secondary opacity-0 transition group-hover:opacity-100">
          Included
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------
   Page
-------------------------------------------------- */

export default async function ProjectPage({
  params,
}: {
  params: ParamsPromise;
}) {
  const { slug } = await params;
  const project = getProjectBySlug(slug);
  if (!project) notFound();

  const tags = project.tags ?? [];
  const cs = project.caseStudy;

  const servicesUsed =
    typeof project.stack === "string" && project.stack.trim().length > 0
      ? project.stack
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

  return (
    <main className="relative">
      {/* sticky top strip */}
      <div className="sticky top-0 z-10 border-b border-white/10 bg-[#070b16]/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
          <Link
            href="/#projects"
            className="inline-flex items-center gap-2 text-sm text-text-primary hover:text-text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Portfolio
          </Link>
        </div>
      </div>

      {/* background wash */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(900px_circle_at_40%_-10%,rgba(56,189,248,0.10),transparent_55%),radial-gradient(900px_circle_at_80%_0%,rgba(168,85,247,0.08),transparent_55%)]" />

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        {/* -------------------------------------------------
            HEADER
        -------------------------------------------------- */}
        <header className="space-y-6">
          <div className="space-y-3">
            <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-text-heading sm:text-5xl">
              {project.title}
            </h1>

            <p className="max-w-3xl text-base leading-relaxed text-text-primary">
              {project.description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {project.featured ? (
              <Badge className="bg-sky-500/10 text-sky-200 hover:bg-sky-500/15">
                Featured
              </Badge>
            ) : null}

            {project.status ? (
              <Badge
                variant="outline"
                className="border-white/15 bg-white/5 text-text-primary hover:bg-white/10"
              >
                {project.status}
              </Badge>
            ) : null}

            {project.type ? (
              <Badge
                variant="outline"
                className="border-white/15 bg-white/5 text-text-primary hover:bg-white/10"
              >
                {project.type}
              </Badge>
            ) : null}
          </div>

          {/* “facts row” makes it feel premium */}
          <div className="flex flex-wrap gap-2">
            {project.stack ? <Pill label="Stack" value={project.stack} /> : null}
            {tags.length ? <Pill label="Tags" value={tags.join(", ")} /> : null}
          </div>

          {/* chips row */}
          {tags.length ? (
            <div className="flex flex-wrap gap-2 pt-1">
              {tags.map((t) => (
                <Chip key={t}>{t}</Chip>
              ))}
            </div>
          ) : null}

          {/* buttons */}
          <div className="flex flex-wrap gap-2 pt-1">
            {project.githubUrl ? (
              <Button
                asChild
                variant="outline"
                className="border-white/15 bg-white/5 text-text-primary hover:bg-white/10"
              >
                <a href={project.githubUrl} target="_blank" rel="noreferrer">
                  <span className="inline-flex items-center gap-2">
                    <Github className="h-4 w-4" />
                    View Code
                  </span>
                </a>
              </Button>
            ) : null}

            {project.demoUrl ? (
              <Button
                asChild
                variant="outline"
                className="border-white/15 bg-white/5 text-text-primary hover:bg-white/10"
              >
                <a href={project.demoUrl} target="_blank" rel="noreferrer">
                  <span className="inline-flex items-center gap-2">
                    <ExternalLink className="h-4 w-4" />
                    Live Demo
                  </span>
                </a>
              </Button>
            ) : null}

          </div>
        </header>

        {/* -------------------------------------------------
            BODY
        -------------------------------------------------- */}
        <div className="mt-10 space-y-12">
          {/* Architecture Diagram */}
          <SoftCard className="p-4 sm:p-6">
            <div className="relative overflow-hidden rounded-xl border border-white/10 bg-white/5">
                {cs?.diagram?.src ? (
                <div className="relative w-full">
                    <Image
                    src={cs.diagram.src}
                    alt={cs.diagram.alt ?? `${project.title} architecture diagram`}
                    width={1400}
                    height={800}
                    className="h-auto w-full"
                    priority
                    />
                    {cs.diagram.caption ? (
                    <p className="border-t border-white/10 px-4 py-3 text-xs text-text-secondary">
                        {cs.diagram.caption}
                    </p>
                    ) : null}
                </div>
                ) : (
                <div className="flex h-60 items-center justify-center">
                    <p className="text-sm text-text-secondary">
                    Diagram will render here (add <span className="text-text-primary">caseStudy.diagram</span>)
                    </p>
                </div>
                )}
                
            </div>
            </SoftCard>


          {/* Problem Statement */}
          <section className="space-y-4">
            <SectionHeader
              icon={<AlertTriangle className="h-5 w-5 text-rose-300" />}
              title="Problem Statement"
              subtitle="Constraints, scale, and what success looks like."
            />
            <SoftCard className="p-5 sm:p-6">
              <p className="text-sm leading-relaxed text-text-primary">
                {cs?.overview ??
                  "Describe the real-world problem this project solves. Keep it concrete: inputs, constraints, scale, and what success looks like."}
              </p>
            </SoftCard>
          </section>

          {/* Solution */}
          <section className="space-y-4">
            <SectionHeader
              icon={<Lightbulb className="h-5 w-5 text-yellow-300" />}
              title="Solution"
              subtitle="How the system works end-to-end."
            />
            <SoftCard className="p-5 sm:p-6">
              <p className="text-sm leading-relaxed text-text-primary">
                {cs?.overview ??
                  "Explain the approach at a high level: event flow, storage, processing, and how you ensure reliability and security."}
              </p>
            </SoftCard>
          </section>

          {/* AWS Services Used */}
          <section className="space-y-4">
            <SectionHeader
              icon={<Cloud className="h-5 w-5 text-amber-300" />}
              title="AWS Services Used"
              subtitle="Core services and why they are in the design."
            />

            {servicesUsed.length ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {servicesUsed.map((s) => (
                  <ServiceTile key={s} name={s} />
                ))}
              </div>
            ) : (
              <SoftCard className="p-5 sm:p-6">
                <p className="text-sm text-text-secondary">
                  Add a <span className="text-text-primary">stack</span> string on
                  the project to list services here.
                </p>
              </SoftCard>
            )}
          </section>

          {/* Architecture Decisions */}
          <section className="space-y-4">
            <SectionHeader
              icon={<CheckCircle2 className="h-5 w-5 text-sky-300" />}
              title="Architecture Decisions"
              subtitle="Tradeoffs and reasoning behind key choices."
            />
            <div className="grid gap-4">
              {cs?.decisions?.length ? (
                cs.decisions.map((d) => (
                  <SoftCard key={d.title} className="p-5 sm:p-6">
                    <p className="text-base font-semibold text-text-primary">
                      {d.title}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-text-primary">
                      {d.detail}
                    </p>
                  </SoftCard>
                ))
              ) : (
                <SoftCard className="p-5 sm:p-6">
                  <p className="text-sm text-text-secondary">
                    Add{" "}
                    <span className="text-text-primary">caseStudy.decisions</span>{" "}
                    to show your tradeoffs here.
                  </p>
                </SoftCard>
              )}
            </div>
          </section>

          {/* Security Model */}
          <section className="space-y-4">
            <SectionHeader
              icon={<Shield className="h-5 w-5 text-emerald-300" />}
              title="Security Model"
              subtitle="IAM, encryption, and exposure controls."
            />
            <div className="grid gap-4">
              {cs?.security?.length ? (
                cs.security.map((line) => (
                  <SoftCard key={line} className="p-5 sm:p-6">
                    <p className="text-sm leading-relaxed text-text-primary">
                      {line}
                    </p>
                  </SoftCard>
                ))
              ) : (
                <SoftCard className="p-5 sm:p-6">
                  <p className="text-sm text-text-secondary">
                    Add{" "}
                    <span className="text-text-primary">caseStudy.security</span>{" "}
                    to list IAM, encryption, network, and exposure choices.
                  </p>
                </SoftCard>
              )}
            </div>
          </section>

          {/* Reliability Patterns */}
          <section className="space-y-4">
            <SectionHeader
              icon={<Sparkles className="h-5 w-5 text-violet-300" />}
              title="Reliability Patterns"
              subtitle="Retries, DLQs, idempotency, and resilience."
            />
            <div className="grid gap-4 md:grid-cols-2">
              {(cs?.failureModes?.length ? cs.failureModes : [])
                .slice(0, 4)
                .map((p) => (
                  <SoftCard key={p} className="p-5 sm:p-6">
                    <p className="text-sm leading-relaxed text-text-primary">
                      {p}
                    </p>
                  </SoftCard>
                ))}

              {!cs?.failureModes?.length ? (
                <SoftCard className="p-5 sm:p-6 md:col-span-2">
                  <p className="text-sm text-text-secondary">
                    Add{" "}
                    <span className="text-text-primary">
                      caseStudy.failureModes
                    </span>{" "}
                    for retries, DLQs, idempotency, timeouts, etc.
                  </p>
                </SoftCard>
              ) : null}
            </div>
          </section>

          {/* Observability */}
          <section className="space-y-4">
            <SectionHeader
              icon={<Activity className="h-5 w-5 text-cyan-300" />}
              title="Observability"
              subtitle="Logs, metrics, alarms, and tracing."
            />
            <div className="grid gap-4 md:grid-cols-2">
              {(cs?.observability?.length ? cs.observability : [])
                .slice(0, 4)
                .map((o) => (
                  <SoftCard key={o} className="p-5 sm:p-6">
                    <p className="text-sm leading-relaxed text-text-primary">{o}</p>
                  </SoftCard>
                ))}

              {!cs?.observability?.length ? (
                <SoftCard className="p-5 sm:p-6 md:col-span-2">
                  <p className="text-sm text-text-secondary">
                    Add{" "}
                    <span className="text-text-primary">
                      caseStudy.observability
                    </span>{" "}
                    for logs, metrics, alarms, tracing.
                  </p>
                </SoftCard>
              ) : null}
            </div>
          </section>

          {/* Cost Considerations */}
          <section className="space-y-4">
            <SectionHeader
              icon={<DollarSign className="h-5 w-5 text-emerald-300" />}
              title="Cost Considerations"
              subtitle="Cost drivers and how you keep them under control."
            />
            <SoftCard className="p-5 sm:p-6">
              {cs?.cost?.length ? (
                <ul className="list-disc space-y-2 pl-5 text-sm text-text-primary">
                  {cs.cost.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-text-secondary">
                  Add <span className="text-text-primary">caseStudy.cost</span> for
                  cost drivers and mitigations.
                </p>
              )}
            </SoftCard>
          </section>

          {/* Key Takeaways */}
          <section className="space-y-4">
            <SectionHeader
              icon={<CheckCircle2 className="h-5 w-5 text-amber-300" />}
              title="Key Takeaways"
              subtitle="What you learned and what you would improve next."
            />
            <SoftCard className="p-5 sm:p-6">
              {cs?.next?.length ? (
                <ul className="space-y-3 text-sm text-text-primary">
                  {cs.next.map((n) => (
                    <li key={n} className="flex gap-3">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-amber-300/80" />
                      <span className="leading-relaxed">{n}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-text-secondary">
                  Add <span className="text-text-primary">caseStudy.next</span> or a
                  dedicated “takeaways” list later.
                </p>
              )}
            </SoftCard>
          </section>

          {/* Technologies Used */}
          <section className="space-y-4">
            <SectionHeader
              icon={<Cloud className="h-5 w-5 text-sky-300" />}
              title="Technologies Used"
              subtitle="Quick scan of tools used in this build."
            />
            <SoftCard className="p-5 sm:p-6">
              <div className="flex flex-wrap gap-2">
                {servicesUsed.length ? (
                  servicesUsed.map((s) => <Chip key={s}>{s}</Chip>)
                ) : (
                  <p className="text-sm text-text-secondary">
                    Add a <span className="text-text-primary">stack</span> string to
                    show chips here.
                  </p>
                )}
              </div>
            </SoftCard>
          </section>
        </div>
      </div>
    </main>
  );
}
