export type ExperienceItem = {
    title: string;
    org: string;
    location?: string;
    dates?: string;
    bullets: string[];
  };
  
export const experience = {
  work: [
    {
      title: "Co-founder",
      org: "Silicon X",
      location: "Vancouver, BC · Remote",
      dates: "2022 – Present",
      bullets: [
        "Co-founded the company and led product delivery across multiple client and internal projects with a lean team.",
        "Owned technical planning and execution from architecture decisions to release readiness and production support.",
        "Designed and operated AWS-based systems (Lambda, API Gateway, S3, DynamoDB, Cognito) with CI/CD and CloudWatch monitoring.",
        "Improved reliability and cost efficiency through deployment guardrails, observability standards, and usage-aware infrastructure decisions.",
      ],
    },
  ] satisfies ExperienceItem[],
  
    education: [
      {
        title: "Bachelors Degree, Computer Science",
        org: "University of British Columbia",
        location: "Canada",
        dates: "2019 – 2024",
        bullets: [
          "Foundations in programming, databases, and systems.",
          "Focused self-study on AWS and modern cloud architecture.",
        ],
      },
    ] satisfies ExperienceItem[],
  };
  
