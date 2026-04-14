import "server-only";

import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import type { SegmentDefinition } from "@/app/app/api/book/_lib/segment-engine";

const PK = "ADMINSEGMENT#DEFS";

function sk(segmentId: string): string {
  return `SEG#${segmentId}`;
}

export async function listSegments(tableName: string): Promise<SegmentDefinition[]> {
  const res = await ddbDoc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: { ":pk": PK },
    }),
  );
  return ((res.Items ?? []) as unknown as SegmentDefinition[]).sort((a, b) =>
    (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""),
  );
}

export async function getSegment(
  tableName: string,
  segmentId: string,
): Promise<SegmentDefinition | null> {
  const res = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: { PK, SK: sk(segmentId) },
    }),
  );
  return ((res.Item ?? null) as unknown) as SegmentDefinition | null;
}

export async function putSegment(
  tableName: string,
  segment: SegmentDefinition,
): Promise<void> {
  await ddbDoc.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK,
        SK: sk(segment.segmentId),
        entity: "ADMIN_SEGMENT",
        ...segment,
      },
    }),
  );
}

export async function deleteSegment(
  tableName: string,
  segmentId: string,
): Promise<void> {
  await ddbDoc.send(
    new DeleteCommand({
      TableName: tableName,
      Key: { PK, SK: sk(segmentId) },
    }),
  );
}

export async function writeAuditEntry(
  tableName: string,
  entry: {
    adminUserId: string;
    action: string;
    segmentId: string;
    affectedUserCount: number;
    params?: Record<string, unknown>;
  },
): Promise<void> {
  const now = new Date().toISOString();
  await ddbDoc.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: `BOOKAUDIT#${entry.adminUserId}`,
        SK: `${now}#${entry.action}`,
        entity: "ADMIN_AUDIT",
        ...entry,
        createdAt: now,
      },
    }),
  );
}
