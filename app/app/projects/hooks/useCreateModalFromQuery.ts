"use client";

import { useEffect } from "react";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { ReadonlyURLSearchParams } from "next/navigation";

export function useCreateModalFromQuery(params: {
  sp: ReadonlyURLSearchParams;
  router: AppRouterInstance;
  open: (v: boolean) => void;
}) {
  const { sp, router, open } = params;

  useEffect(() => {
    if (sp.get("create") === "1") {
      open(true);
      router.replace("/app/projects");
    }
  }, [sp, router, open]);
}
