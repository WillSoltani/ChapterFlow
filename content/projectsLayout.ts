import type { Project } from "@/types/project";

export const projects: Project[] = [
  {
    slug: "serverless-file-pipeline",
    title: "Serverless File Processing Pipeline",
    description:
      "Upload files, detect format, run a configurable pipeline (convert, extract, enrich), and deliver results with observable, secure AWS primitives.",
    githubUrl: "https://github.com/WillSoltani/your-repo",
    demoUrl: "https://your-domain.com",
    tags: ["Serverless", "IaC", "Security", "Observability"],
    featured: true,
    type: "Serverless Web App",
    stack: "Next.js, API Gateway, Lambda, S3, DynamoDB",
    status: "In progress",
    caseStudy: {
      overview:
        "A serverless-first pipeline platform that lets users upload files and run transformations with strong isolation and auditability.",
      architecture: [
        "S3 pre-signed uploads from the browser",
        "Event-driven processing via S3 events → SQS → Lambda",
        "State tracked in DynamoDB with idempotency keys",
      ],
      decisions: [
        {
          title: "SQS between S3 and Lambda",
          detail:
            "Buffers spikes and enables retries/DLQ. Avoids direct fan-out failures from S3 events at scale.",
        },
      ],
      security: [
        "Least-privilege IAM roles per function",
        "S3 SSE-KMS encryption and TLS-only",
        "Pre-signed URL with short TTL and content-type constraints",
      ],
      observability: [
        "Structured logs with correlation IDs",
        "CloudWatch metrics + alarms on error rate and latency",
        "Tracing for the pipeline steps where useful",
      ],
      failureModes: [
        "Retries with backoff and DLQ for poison messages",
        "Idempotency to prevent double-processing",
      ],
      cost: [
        "Primary drivers: Lambda duration, S3 storage/requests, data transfer",
        "Mitigations: batching, right-sized memory, lifecycle policies",
      ],
      next: [
        "Add auth (Cognito) + per-user isolation",
        "Add admin dashboard and cost visibility",
      ],
    },
  },
];
