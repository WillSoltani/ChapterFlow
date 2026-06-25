import {
  DynamoDBClient,
  CreateTableCommand,
  DeleteTableCommand,
  DescribeTableCommand,
  ResourceNotFoundException,
  type CreateTableCommandInput,
} from "@aws-sdk/client-dynamodb";

/**
 * Resolve the DynamoDB Local endpoint.
 *
 * The app's own client (`app/app/api/_lib/aws.ts`) is constructed with only
 * `{ region }`; AWS SDK v3 honours `AWS_ENDPOINT_URL_DYNAMODB` (verified against
 * @smithy/core getEndpointUrlConfig, serviceId "DynamoDB" → env var
 * `AWS_ENDPOINT_URL_DYNAMODB`) at client construction, so the prod code talks to
 * DynamoDB Local with NO source edit when that env var + dummy creds are set
 * before the module is imported. This helper builds a *separate* admin client for
 * table create/teardown using the same endpoint.
 */
export function localDynamoEndpoint(): string {
  return (
    process.env.AWS_ENDPOINT_URL_DYNAMODB ||
    process.env.AWS_ENDPOINT_URL ||
    "http://127.0.0.1:8000"
  );
}

/**
 * Hard safety guard: refuse to run destructive table create/drop against
 * anything but a loopback DynamoDB endpoint. These helpers DROP and CREATE a
 * table; if `AWS_ENDPOINT_URL_DYNAMODB` is mis-set (or unset, resolving to the
 * SDK default of real AWS), an unguarded create/drop could destroy a live prod
 * table. Assert the resolved host is 127.0.0.1 / localhost / [::1], throwing
 * otherwise — so destructive ops can NEVER target real AWS.
 */
export function assertLoopbackEndpoint(): void {
  const endpoint = localDynamoEndpoint();
  let host: string;
  try {
    host = new URL(endpoint).hostname;
  } catch {
    throw new Error(
      `Refusing destructive DynamoDB op: endpoint "${endpoint}" is not a parseable URL`,
    );
  }
  const normalized = host.replace(/^\[|\]$/g, "").toLowerCase();
  const isLoopback =
    normalized === "127.0.0.1" ||
    normalized === "localhost" ||
    normalized === "::1";
  if (!isLoopback) {
    throw new Error(
      `Refusing destructive DynamoDB op: endpoint host "${host}" is not loopback ` +
        `(expected 127.0.0.1/localhost). Set AWS_ENDPOINT_URL_DYNAMODB to DynamoDB Local.`,
    );
  }
}

export function makeAdminClient(): DynamoDBClient {
  return new DynamoDBClient({
    region: process.env.AWS_REGION || "us-east-1",
    endpoint: localDynamoEndpoint(),
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "dummy",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "dummy",
    },
  });
}

/**
 * Create the single-table schema, mirroring `ChapterFlowAppTable` in
 * `infra/lib/chapterflow-backend-stack.ts`:
 *   - base key: PK (S, HASH) + SK (S, RANGE)
 *   - billing: PAY_PER_REQUEST
 *   - GSI `quiz-scope-createdAt-index`: quizScope (S, HASH) + createdAt (S, RANGE)
 *
 * The GSI is NOT load-bearing for the journey tests (the repos query the base
 * table by PK), but it is created for schema fidelity so a future GSI-backed
 * test does not need a schema migration. Idempotent: a pre-existing table is
 * dropped and recreated so each run starts clean.
 */
export async function createBookTable(
  client: DynamoDBClient,
  tableName: string,
): Promise<void> {
  assertLoopbackEndpoint();
  await dropTableIfExists(client, tableName);

  const input: CreateTableCommandInput = {
    TableName: tableName,
    BillingMode: "PAY_PER_REQUEST",
    AttributeDefinitions: [
      { AttributeName: "PK", AttributeType: "S" },
      { AttributeName: "SK", AttributeType: "S" },
      { AttributeName: "quizScope", AttributeType: "S" },
      { AttributeName: "createdAt", AttributeType: "S" },
    ],
    KeySchema: [
      { AttributeName: "PK", KeyType: "HASH" },
      { AttributeName: "SK", KeyType: "RANGE" },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: "quiz-scope-createdAt-index",
        KeySchema: [
          { AttributeName: "quizScope", KeyType: "HASH" },
          { AttributeName: "createdAt", KeyType: "RANGE" },
        ],
        Projection: { ProjectionType: "ALL" },
      },
    ],
  };

  await client.send(new CreateTableCommand(input));
  await waitForActive(client, tableName);
}

export async function dropTableIfExists(
  client: DynamoDBClient,
  tableName: string,
): Promise<void> {
  assertLoopbackEndpoint();
  try {
    await client.send(new DeleteTableCommand({ TableName: tableName }));
  } catch (error: unknown) {
    if (error instanceof ResourceNotFoundException) return;
    if (
      error &&
      typeof error === "object" &&
      (error as { name?: string }).name === "ResourceNotFoundException"
    ) {
      return;
    }
    throw error;
  }
}

async function waitForActive(
  client: DynamoDBClient,
  tableName: string,
  attempts = 50,
): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await client.send(
        new DescribeTableCommand({ TableName: tableName }),
      );
      if (res.Table?.TableStatus === "ACTIVE") return;
    } catch (error: unknown) {
      if (
        !(error instanceof ResourceNotFoundException) &&
        (error as { name?: string })?.name !== "ResourceNotFoundException"
      ) {
        throw error;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`DynamoDB Local table ${tableName} did not become ACTIVE`);
}
