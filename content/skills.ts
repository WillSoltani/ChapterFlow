export type SkillCategory = {
    title: string;
    items: string[];
  };
  
  export const skillCategories: SkillCategory[] = [
    {
      title: "AWS Application Platform",
      items: ["App Runner", "Amplify", "CloudFront", "Route 53", "S3", "Lambda", "API Gateway"],
    },
    {
      title: "AWS Workflows & Data",
      items: ["Step Functions", "DynamoDB", "EventBridge", "SQS", "SNS", "RDS"],
    },
    {
      title: "Security & Observability",
      items: ["IAM", "Cognito", "KMS", "CloudWatch", "X-Ray", "Systems Manager Parameter Store"],
    },
    {
      title: "Delivery & Infrastructure",
      items: ["CDK", "CloudFormation", "ECR", "ECS/Fargate", "Docker", "CI/CD Pipelines"],
    },
    {
      title: "Languages & Tools",
      items: ["TypeScript", "Python", "Bash", "Ruby", "Rust", "GitHub Actions"],
    },
  ];
  
