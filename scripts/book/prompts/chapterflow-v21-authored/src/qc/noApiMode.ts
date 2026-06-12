export function isNoApiCodexQcMode(): boolean {
  return process.env.CHAPTERFLOW_NO_API_CODEX_QC === "1";
}

