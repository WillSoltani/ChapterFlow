import type { ReactNode } from "react";
import { ProjectsChrome } from "./components/ProjectsChrome";

export default function ProjectsLayout({ children }: { children: ReactNode }) {
  return <ProjectsChrome>{children}</ProjectsChrome>;
}
