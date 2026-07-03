export type ProseRisk = {
  score: number;
  severe: string[];
  local: string[];
  advisory: string[];
};

const SEVERE_PATTERNS = [/too long/i, /too short/i, /reading/i, /opening/i, /closing/i, /cross-tier/i];
const LOCAL_PATTERNS = [/em dash/i, /paragraph/i, /cadence/i, /phrase/i];

export function scoreProseIssues(issues: string[]): ProseRisk {
  const severe: string[] = [];
  const local: string[] = [];
  const advisory: string[] = [];

  for (const issue of issues) {
    if (SEVERE_PATTERNS.some((re) => re.test(issue))) severe.push(issue);
    else if (LOCAL_PATTERNS.some((re) => re.test(issue))) local.push(issue);
    else advisory.push(issue);
  }

  return {
    score: severe.length * 2 + local.length + Math.ceil(advisory.length / 3),
    severe,
    local,
    advisory,
  };
}
