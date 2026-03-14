import "server-only";

import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  type UpdateCommandInput,
} from "@aws-sdk/lib-dynamodb";

import { ddbDoc, getTableName } from "./aws";
import type { RequestActor } from "./actor";

export const DEFAULT_SIGNED_IN_LIMIT = 10;
export const DEFAULT_GUEST_LIMIT = 5;

const QUOTA_CONFIG_PK = "CONFIG#QUOTAS";
const QUOTA_CONFIG_SK = "GLOBAL";
const QUOTA_USAGE_SK = "USAGE";

type Scope = "signed_in" | "guest";

export type QuotaState = {
  scope: Scope;
  limit: number;
  used: number;
  remaining: number;
  exhausted: boolean;
};

export type GlobalQuotaConfig = {
  signedInLimit: number;
  guestLimit: number;
};

export type ReserveQuotaResult =
  | { ok: true; stateAfter: QuotaState }
  | { ok: false; stateAfter: QuotaState };

type UsageRow = {
  usedCount: number;
  limitOverride: number | null;
};

function clampNonNegativeInt(v: unknown, fallback: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  if (v < 0) return fallback;
  return Math.floor(v);
}

function quotaUsagePkForActor(actor: RequestActor): string {
  if (actor.kind === "guest") {
    return `QUOTA#GUEST#${actor.guestSessionId}`;
  }
  return `QUOTA#USER#${actor.sub}`;
}

function actorTypeForUsage(actor: RequestActor): "guest" | "user" {
  return actor.kind === "guest" ? "guest" : "user";
}

function conditionalCheckFailed(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const maybe = error as { name?: unknown; __type?: unknown };
  const name = typeof maybe.name === "string" ? maybe.name : "";
  const type = typeof maybe.__type === "string" ? maybe.__type : "";
  return (
    name.includes("ConditionalCheckFailedException") ||
    type.includes("ConditionalCheckFailedException")
  );
}

function usageFromItem(item: unknown): UsageRow {
  if (typeof item !== "object" || item === null) {
    return { usedCount: 0, limitOverride: null };
  }
  const rec = item as Record<string, unknown>;
  const usedCount = clampNonNegativeInt(rec.usedCount, 0);
  const limitOverrideRaw = rec.limitOverride;
  const limitOverride =
    typeof limitOverrideRaw === "number" && Number.isFinite(limitOverrideRaw) && limitOverrideRaw >= 0
      ? Math.floor(limitOverrideRaw)
      : null;
  return { usedCount, limitOverride };
}

function configFromItem(item: unknown): GlobalQuotaConfig {
  if (typeof item !== "object" || item === null) {
    return {
      signedInLimit: DEFAULT_SIGNED_IN_LIMIT,
      guestLimit: DEFAULT_GUEST_LIMIT,
    };
  }
  const rec = item as Record<string, unknown>;
  return {
    signedInLimit: clampNonNegativeInt(rec.signedInLimit, DEFAULT_SIGNED_IN_LIMIT),
    guestLimit: clampNonNegativeInt(rec.guestLimit, DEFAULT_GUEST_LIMIT),
  };
}

function effectiveLimitForActor(args: {
  actor: RequestActor;
  config: GlobalQuotaConfig;
  usage: UsageRow;
}): number {
  if (args.usage.limitOverride != null) return args.usage.limitOverride;
  return args.actor.kind === "guest" ? args.config.guestLimit : args.config.signedInLimit;
}

function quotaStateFor(actor: RequestActor, limit: number, usedCount: number): QuotaState {
  const used = Math.max(0, Math.floor(usedCount));
  const boundedLimit = Math.max(0, Math.floor(limit));
  const remaining = Math.max(0, boundedLimit - used);
  return {
    scope: actor.kind === "guest" ? "guest" : "signed_in",
    limit: boundedLimit,
    used,
    remaining,
    exhausted: remaining <= 0,
  };
}

async function loadGlobalConfig(tableName: string): Promise<GlobalQuotaConfig> {
  const res = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: { PK: QUOTA_CONFIG_PK, SK: QUOTA_CONFIG_SK },
      ConsistentRead: true,
    })
  );
  return configFromItem(res.Item);
}

async function loadUsage(tableName: string, actor: RequestActor): Promise<UsageRow> {
  const res = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: { PK: quotaUsagePkForActor(actor), SK: QUOTA_USAGE_SK },
      ConsistentRead: true,
    })
  );
  return usageFromItem(res.Item);
}

export async function getQuotaStateForActor(actor: RequestActor): Promise<QuotaState> {
  const tableName = await getTableName();
  const [config, usage] = await Promise.all([
    loadGlobalConfig(tableName),
    loadUsage(tableName, actor),
  ]);
  const limit = effectiveLimitForActor({ actor, config, usage });
  return quotaStateFor(actor, limit, usage.usedCount);
}

export async function reserveQuota(actor: RequestActor, amount: number): Promise<ReserveQuotaResult> {
  const requested = Math.max(0, Math.floor(amount));
  if (requested <= 0) {
    return { ok: true, stateAfter: await getQuotaStateForActor(actor) };
  }

  const tableName = await getTableName();
  const [config, usage] = await Promise.all([
    loadGlobalConfig(tableName),
    loadUsage(tableName, actor),
  ]);
  const limit = effectiveLimitForActor({ actor, config, usage });

  const params: UpdateCommandInput = {
    TableName: tableName,
    Key: { PK: quotaUsagePkForActor(actor), SK: QUOTA_USAGE_SK },
    UpdateExpression:
      "SET usedCount = if_not_exists(usedCount, :zero) + :inc, " +
      "updatedAt = :now, createdAt = if_not_exists(createdAt, :now), " +
      "entity = if_not_exists(entity, :entity), actorType = if_not_exists(actorType, :actorType), " +
      "userSub = if_not_exists(userSub, :userSub)",
    ConditionExpression:
      "(attribute_not_exists(usedCount) AND :inc <= :limit) OR usedCount <= :maxBefore",
    ExpressionAttributeValues: {
      ":zero": 0,
      ":inc": requested,
      ":limit": limit,
      ":maxBefore": limit - requested,
      ":now": new Date().toISOString(),
      ":entity": "QUOTA_USAGE",
      ":actorType": actorTypeForUsage(actor),
      ":userSub": actor.sub,
    },
    ReturnValues: "ALL_NEW",
  };

  try {
    const res = await ddbDoc.send(new UpdateCommand(params));
    const next = usageFromItem(res.Attributes);
    return { ok: true, stateAfter: quotaStateFor(actor, limit, next.usedCount) };
  } catch (error: unknown) {
    if (!conditionalCheckFailed(error)) throw error;
    return { ok: false, stateAfter: quotaStateFor(actor, limit, usage.usedCount) };
  }
}

export async function getGlobalQuotaConfig(): Promise<GlobalQuotaConfig> {
  const tableName = await getTableName();
  return loadGlobalConfig(tableName);
}

export async function setGlobalQuotaConfig(config: Partial<GlobalQuotaConfig>): Promise<GlobalQuotaConfig> {
  const current = await getGlobalQuotaConfig();
  const signedInLimit = clampNonNegativeInt(config.signedInLimit, current.signedInLimit);
  const guestLimit = clampNonNegativeInt(config.guestLimit, current.guestLimit);

  const tableName = await getTableName();
  const now = new Date().toISOString();
  await ddbDoc.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        PK: QUOTA_CONFIG_PK,
        SK: QUOTA_CONFIG_SK,
        entity: "QUOTA_CONFIG",
        signedInLimit,
        guestLimit,
        updatedAt: now,
        createdAt: now,
      },
    })
  );

  return { signedInLimit, guestLimit };
}

function overrideUsagePk(scope: Scope, subjectId: string): string {
  if (scope === "guest") return `QUOTA#GUEST#${subjectId}`;
  return `QUOTA#USER#${subjectId}`;
}

export async function setLimitOverride(args: {
  scope: Scope;
  subjectId: string;
  limit: number;
}): Promise<void> {
  const subjectId = String(args.subjectId || "").trim();
  if (!subjectId) throw new Error("subjectId is required");
  const limit = Math.max(0, Math.floor(args.limit));
  const tableName = await getTableName();
  const now = new Date().toISOString();
  await ddbDoc.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { PK: overrideUsagePk(args.scope, subjectId), SK: QUOTA_USAGE_SK },
      UpdateExpression:
        "SET limitOverride = :limit, updatedAt = :now, createdAt = if_not_exists(createdAt, :now), " +
        "entity = if_not_exists(entity, :entity), actorType = if_not_exists(actorType, :actorType)",
      ExpressionAttributeValues: {
        ":limit": limit,
        ":now": now,
        ":entity": "QUOTA_USAGE",
        ":actorType": args.scope === "guest" ? "guest" : "user",
      },
    })
  );
}

export async function clearLimitOverride(args: {
  scope: Scope;
  subjectId: string;
}): Promise<void> {
  const subjectId = String(args.subjectId || "").trim();
  if (!subjectId) throw new Error("subjectId is required");
  const tableName = await getTableName();
  await ddbDoc.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { PK: overrideUsagePk(args.scope, subjectId), SK: QUOTA_USAGE_SK },
      UpdateExpression: "REMOVE limitOverride SET updatedAt = :now",
      ExpressionAttributeValues: { ":now": new Date().toISOString() },
    })
  );
}

export async function getUsageOverrideState(args: {
  scope: Scope;
  subjectId: string;
}): Promise<UsageRow> {
  const subjectId = String(args.subjectId || "").trim();
  if (!subjectId) throw new Error("subjectId is required");
  const tableName = await getTableName();
  const res = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: { PK: overrideUsagePk(args.scope, subjectId), SK: QUOTA_USAGE_SK },
      ConsistentRead: true,
    })
  );
  return usageFromItem(res.Item);
}
