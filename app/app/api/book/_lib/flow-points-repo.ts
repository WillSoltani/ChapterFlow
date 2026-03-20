import "server-only";

import {
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import {
  bookUserPk,
  engagementSk,
  entitlementSk,
  flowPointsGrantSk,
  flowPointsLedgerSk,
  nowIso,
  referralClaimSk,
  referralCodePk,
  referralCodeSk,
  referralProfileSk,
  rewardClaimSk,
  rewardRedemptionSk,
} from "@/app/app/api/book/_lib/keys";
import type {
  BookReferralCodeLookupItem,
  BookUserEngagementItem,
  BookUserReferralClaimItem,
  BookUserReferralProfileItem,
  BookUserRewardClaimItem,
  BookUserRewardRedemptionItem,
  BookUserFlowPointsLedgerItem,
  FlowPointsRewardId,
  FlowPointsSourceType,
} from "@/app/app/api/book/_lib/types";

function readNum(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readStr(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function parseRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function isConditionalCheckFailed(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const rec = error as Record<string, unknown>;
  return (
    rec.name === "ConditionalCheckFailedException" ||
    rec.__type === "ConditionalCheckFailedException" ||
    rec.name === "TransactionCanceledException"
  );
}

function parseFlowPointsState(
  item: Record<string, unknown> | undefined,
  userId: string
): BookUserEngagementItem {
  return {
    userId,
    points: Math.max(0, readNum(item?.points) ?? 0),
    lifetimeEarned: Math.max(0, readNum(item?.lifetimeEarned) ?? 0),
    lifetimeSpent: Math.max(0, readNum(item?.lifetimeSpent) ?? 0),
    totalEarnEvents: Math.max(0, readNum(item?.totalEarnEvents) ?? 0),
    totalSpendEvents: Math.max(0, readNum(item?.totalSpendEvents) ?? 0),
    createdAt: readStr(item?.createdAt) ?? "",
    updatedAt: readStr(item?.updatedAt) ?? "",
  };
}

function parseLedgerItem(
  item: Record<string, unknown> | undefined,
  userId: string
): BookUserFlowPointsLedgerItem | null {
  const transactionId = readStr(item?.transactionId);
  const direction = item?.direction;
  const amount = readNum(item?.amount);
  const sourceType = readStr(item?.sourceType) as FlowPointsSourceType | undefined;
  const sourceId = readStr(item?.sourceId);
  if (
    !transactionId ||
    (direction !== "earn" && direction !== "spend" && direction !== "adjustment") ||
    typeof amount !== "number" ||
    !sourceType ||
    !sourceId
  ) {
    return null;
  }
  return {
    userId,
    transactionId,
    direction,
    amount: Math.max(0, amount),
    sourceType,
    sourceId,
    rewardId: readStr(item?.rewardId) as FlowPointsRewardId | undefined,
    metadata: parseRecord(item?.metadata),
    createdAt: readStr(item?.createdAt) ?? "",
    updatedAt: readStr(item?.updatedAt) ?? "",
  };
}

function parseRewardRedemptionItem(
  item: Record<string, unknown> | undefined,
  userId: string
): BookUserRewardRedemptionItem | null {
  const redemptionId = readStr(item?.redemptionId);
  const rewardId = readStr(item?.rewardId) as FlowPointsRewardId | undefined;
  const costPoints = readNum(item?.costPoints);
  if (!redemptionId || !rewardId || typeof costPoints !== "number") return null;
  return {
    userId,
    redemptionId,
    rewardId,
    costPoints: Math.max(0, costPoints),
    status: "fulfilled",
    metadata: parseRecord(item?.metadata),
    createdAt: readStr(item?.createdAt) ?? "",
    updatedAt: readStr(item?.updatedAt) ?? "",
  };
}

function parseReferralProfile(
  item: Record<string, unknown> | undefined,
  userId: string
): BookUserReferralProfileItem | null {
  const inviteCode = readStr(item?.inviteCode);
  if (!inviteCode) return null;
  return {
    userId,
    inviteCode,
    pendingInvites: Math.max(0, readNum(item?.pendingInvites) ?? 0),
    activatedInvites: Math.max(0, readNum(item?.activatedInvites) ?? 0),
    proInvites: Math.max(0, readNum(item?.proInvites) ?? 0),
    activationPointsEarned: Math.max(0, readNum(item?.activationPointsEarned) ?? 0),
    proPointsEarned: Math.max(0, readNum(item?.proPointsEarned) ?? 0),
    createdAt: readStr(item?.createdAt) ?? "",
    updatedAt: readStr(item?.updatedAt) ?? "",
  };
}

function parseReferralClaim(
  item: Record<string, unknown> | undefined,
  userId: string
): BookUserReferralClaimItem | null {
  const claimId = readStr(item?.claimId);
  const inviterUserId = readStr(item?.inviterUserId);
  const inviteCode = readStr(item?.inviteCode);
  const status = item?.status;
  if (
    !claimId ||
    !inviterUserId ||
    !inviteCode ||
    (status !== "pending" &&
      status !== "activated" &&
      status !== "paid" &&
      status !== "blocked" &&
      status !== "expired")
  ) {
    return null;
  }
  return {
    userId,
    claimId,
    inviterUserId,
    inviteCode,
    status,
    claimedAt: readStr(item?.claimedAt) ?? "",
    activationQualifiedAt: readStr(item?.activationQualifiedAt),
    activationRewardedAt: readStr(item?.activationRewardedAt),
    proRewardedAt: readStr(item?.proRewardedAt),
    blockedReason: readStr(item?.blockedReason),
    updatedAt: readStr(item?.updatedAt) ?? "",
  };
}

function parseRewardClaim(
  item: Record<string, unknown> | undefined,
  userId: string
): BookUserRewardClaimItem | null {
  const rewardId = readStr(item?.rewardId) as FlowPointsRewardId | undefined;
  const redemptionId = readStr(item?.redemptionId);
  const claimedAt = readStr(item?.claimedAt);
  if (!rewardId || !redemptionId || !claimedAt) return null;
  return {
    userId,
    rewardId,
    redemptionId,
    claimedAt,
    updatedAt: readStr(item?.updatedAt) ?? claimedAt,
  };
}

function generateInviteCode(): string {
  return `CF${crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export async function getUserFlowPointsState(
  tableName: string,
  userId: string
): Promise<BookUserEngagementItem> {
  const res = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: bookUserPk(userId),
        SK: engagementSk(),
      },
    })
  );
  return parseFlowPointsState((res.Item as Record<string, unknown> | undefined) ?? undefined, userId);
}

export async function listRecentFlowPointsLedger(
  tableName: string,
  userId: string,
  limit = 8
): Promise<BookUserFlowPointsLedgerItem[]> {
  const cappedLimit = Math.max(1, Math.min(20, Math.floor(limit)));
  const res = await ddbDoc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk": bookUserPk(userId),
        ":prefix": "FLOWPOINTS#",
      },
      ScanIndexForward: false,
      Limit: cappedLimit,
    })
  );
  return (res.Items ?? [])
    .map((item) => parseLedgerItem(item as Record<string, unknown>, userId))
    .filter((item): item is BookUserFlowPointsLedgerItem => item !== null);
}

export async function listRewardRedemptions(
  tableName: string,
  userId: string,
  limit = 20
): Promise<BookUserRewardRedemptionItem[]> {
  const res = await ddbDoc.send(
    new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: {
        ":pk": bookUserPk(userId),
        ":prefix": "REDEMPTION#",
      },
      ScanIndexForward: false,
      Limit: Math.max(1, Math.min(50, Math.floor(limit))),
    })
  );
  return (res.Items ?? [])
    .map((item) => parseRewardRedemptionItem(item as Record<string, unknown>, userId))
    .filter((item): item is BookUserRewardRedemptionItem => item !== null);
}

export async function getUserRewardClaim(
  tableName: string,
  userId: string,
  rewardId: FlowPointsRewardId
): Promise<BookUserRewardClaimItem | null> {
  const res = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: bookUserPk(userId),
        SK: rewardClaimSk(rewardId),
      },
    })
  );
  return parseRewardClaim((res.Item as Record<string, unknown> | undefined) ?? undefined, userId);
}

export async function getReferralCodeLookup(
  tableName: string,
  inviteCode: string
): Promise<BookReferralCodeLookupItem | null> {
  const normalized = inviteCode.trim().toUpperCase();
  if (!normalized) return null;
  const res = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: referralCodePk(normalized),
        SK: referralCodeSk(),
      },
    })
  );
  const item = res.Item as Record<string, unknown> | undefined;
  const inviterUserId = readStr(item?.inviterUserId);
  if (!inviterUserId) return null;
  return {
    inviteCode: readStr(item?.inviteCode) ?? normalized,
    inviterUserId,
    createdAt: readStr(item?.createdAt) ?? "",
    updatedAt: readStr(item?.updatedAt) ?? "",
  };
}

export async function getUserReferralProfile(
  tableName: string,
  userId: string
): Promise<BookUserReferralProfileItem | null> {
  const res = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: bookUserPk(userId),
        SK: referralProfileSk(),
      },
    })
  );
  return parseReferralProfile((res.Item as Record<string, unknown> | undefined) ?? undefined, userId);
}

export async function getOrCreateUserReferralProfile(
  tableName: string,
  userId: string
): Promise<BookUserReferralProfileItem> {
  const existing = await getUserReferralProfile(tableName, userId);
  if (existing) return existing;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const createdAt = nowIso();
    const inviteCode = generateInviteCode();
    try {
      await ddbDoc.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: tableName,
                Item: {
                  PK: bookUserPk(userId),
                  SK: referralProfileSk(),
                  entity: "BOOK_USER_REFERRAL_PROFILE",
                  userId,
                  inviteCode,
                  pendingInvites: 0,
                  activatedInvites: 0,
                  proInvites: 0,
                  activationPointsEarned: 0,
                  proPointsEarned: 0,
                  createdAt,
                  updatedAt: createdAt,
                },
                ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
              },
            },
            {
              Put: {
                TableName: tableName,
                Item: {
                  PK: referralCodePk(inviteCode),
                  SK: referralCodeSk(),
                  entity: "BOOK_REFERRAL_CODE_LOOKUP",
                  inviteCode,
                  inviterUserId: userId,
                  createdAt,
                  updatedAt: createdAt,
                },
                ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
              },
            },
          ],
        })
      );
      return {
        userId,
        inviteCode,
        pendingInvites: 0,
        activatedInvites: 0,
        proInvites: 0,
        activationPointsEarned: 0,
        proPointsEarned: 0,
        createdAt,
        updatedAt: createdAt,
      };
    } catch (error: unknown) {
      if (!isConditionalCheckFailed(error)) throw error;
      const profile = await getUserReferralProfile(tableName, userId);
      if (profile) return profile;
    }
  }

  throw new BookApiError(500, "referral_code_generation_failed", "Could not create a referral code.");
}

export async function getUserReferralClaim(
  tableName: string,
  userId: string
): Promise<BookUserReferralClaimItem | null> {
  const res = await ddbDoc.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: bookUserPk(userId),
        SK: referralClaimSk(),
      },
    })
  );
  return parseReferralClaim((res.Item as Record<string, unknown> | undefined) ?? undefined, userId);
}

export async function createReferralClaimFromCode(
  tableName: string,
  params: {
    invitedUserId: string;
    inviteCode: string;
  }
): Promise<
  | { created: true; claim: BookUserReferralClaimItem }
  | { created: false; reason: "invalid_code" | "self_referral" | "already_claimed" }
> {
  const lookup = await getReferralCodeLookup(tableName, params.inviteCode);
  if (!lookup) {
    return { created: false, reason: "invalid_code" };
  }
  if (lookup.inviterUserId === params.invitedUserId) {
    return { created: false, reason: "self_referral" };
  }

  const claimId = crypto.randomUUID();
  const claimedAt = nowIso();
  const claim: BookUserReferralClaimItem = {
    userId: params.invitedUserId,
    claimId,
    inviterUserId: lookup.inviterUserId,
    inviteCode: lookup.inviteCode,
    status: "pending",
    claimedAt,
    updatedAt: claimedAt,
  };

  try {
    await ddbDoc.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: tableName,
              Item: {
                PK: bookUserPk(params.invitedUserId),
                SK: referralClaimSk(),
                entity: "BOOK_USER_REFERRAL_CLAIM",
                ...claim,
              },
              ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
            },
          },
          {
            Update: {
              TableName: tableName,
              Key: {
                PK: bookUserPk(lookup.inviterUserId),
                SK: referralProfileSk(),
              },
              UpdateExpression:
                "SET entity = if_not_exists(entity, :entity), userId = :userId, inviteCode = if_not_exists(inviteCode, :inviteCode), createdAt = if_not_exists(createdAt, :createdAt), updatedAt = :updatedAt ADD pendingInvites :one",
              ExpressionAttributeValues: {
                ":entity": "BOOK_USER_REFERRAL_PROFILE",
                ":userId": lookup.inviterUserId,
                ":inviteCode": lookup.inviteCode,
                ":createdAt": lookup.createdAt || claimedAt,
                ":updatedAt": claimedAt,
                ":one": 1,
              },
            },
          },
        ],
      })
    );
    return { created: true, claim };
  } catch (error: unknown) {
    if (isConditionalCheckFailed(error)) {
      return { created: false, reason: "already_claimed" };
    }
    throw error;
  }
}

export async function awardFlowPoints(
  tableName: string,
  params: {
    userId: string;
    amount: number;
    sourceType: FlowPointsSourceType;
    sourceId: string;
    rewardId?: FlowPointsRewardId;
    metadata?: Record<string, unknown>;
    createdAt?: string;
  }
): Promise<{ awarded: boolean; state: BookUserEngagementItem; transactionId?: string }> {
  const amount = Math.max(0, Math.floor(params.amount));
  const sourceId = params.sourceId.trim();
  if (!amount || !sourceId) {
    return {
      awarded: false,
      state: await getUserFlowPointsState(tableName, params.userId),
    };
  }

  const createdAt = params.createdAt ?? nowIso();
  const transactionId = crypto.randomUUID();
  try {
    await ddbDoc.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: tableName,
              Item: {
                PK: bookUserPk(params.userId),
                SK: flowPointsGrantSk(params.sourceType, sourceId),
                entity: "BOOK_USER_FLOW_POINTS_GRANT",
                userId: params.userId,
                sourceType: params.sourceType,
                sourceId,
                amount,
                metadata: params.metadata ?? {},
                createdAt,
                updatedAt: createdAt,
              },
              ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
            },
          },
          {
            Update: {
              TableName: tableName,
              Key: {
                PK: bookUserPk(params.userId),
                SK: engagementSk(),
              },
              UpdateExpression:
                "SET entity = :entity, userId = :userId, createdAt = if_not_exists(createdAt, :createdAt), updatedAt = :updatedAt ADD points :delta, lifetimeEarned :delta, totalEarnEvents :one",
              ExpressionAttributeValues: {
                ":entity": "BOOK_USER_ENGAGEMENT",
                ":userId": params.userId,
                ":createdAt": createdAt,
                ":updatedAt": createdAt,
                ":delta": amount,
                ":one": 1,
              },
            },
          },
          {
            Put: {
              TableName: tableName,
              Item: {
                PK: bookUserPk(params.userId),
                SK: flowPointsLedgerSk(createdAt, transactionId),
                entity: "BOOK_USER_FLOW_POINTS_LEDGER",
                userId: params.userId,
                transactionId,
                direction: "earn",
                amount,
                sourceType: params.sourceType,
                sourceId,
                rewardId: params.rewardId,
                metadata: params.metadata ?? {},
                createdAt,
                updatedAt: createdAt,
              },
              ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
            },
          },
        ],
      })
    );
  } catch (error: unknown) {
    if (isConditionalCheckFailed(error)) {
      return {
        awarded: false,
        state: await getUserFlowPointsState(tableName, params.userId),
      };
    }
    throw error;
  }

  return {
    awarded: true,
    state: await getUserFlowPointsState(tableName, params.userId),
    transactionId,
  };
}

export async function redeemFlowPointsReward(
  tableName: string,
  params: {
    userId: string;
    rewardId: FlowPointsRewardId;
    costPoints: number;
    metadata?: Record<string, unknown>;
    bookSlotDelta?: number;
    passExpiresAt?: string;
  }
): Promise<{ state: BookUserEngagementItem; redemptionId: string }> {
  const now = nowIso();
  const redemptionId = crypto.randomUUID();
  const costPoints = Math.max(0, Math.floor(params.costPoints));

  const entitlementUpdate =
    typeof params.bookSlotDelta === "number"
      ? {
          Update: {
            TableName: tableName,
            Key: {
              PK: bookUserPk(params.userId),
              SK: entitlementSk(),
            },
            UpdateExpression:
              "SET #plan = if_not_exists(#plan, :freePlan), updatedAt = :updatedAt, freeBookSlots = if_not_exists(freeBookSlots, :defaultSlots) + :slotDelta, unlockedBookIds = if_not_exists(unlockedBookIds, :emptySet)",
            ExpressionAttributeNames: {
              "#plan": "plan",
            },
            ExpressionAttributeValues: {
              ":freePlan": "FREE",
              ":updatedAt": now,
              ":defaultSlots": 2,
              ":slotDelta": Math.max(1, Math.floor(params.bookSlotDelta)),
              ":emptySet": new Set<string>(),
            },
          },
        }
      : {
          Update: {
            TableName: tableName,
            Key: {
              PK: bookUserPk(params.userId),
              SK: entitlementSk(),
            },
            UpdateExpression:
              "SET #plan = :proPlan, proStatus = :activeStatus, proSource = :flowSource, currentPeriodEnd = :periodEnd, licenseKey = :nullValue, licenseExpiresAt = :nullValue, updatedAt = :updatedAt, freeBookSlots = if_not_exists(freeBookSlots, :defaultSlots), unlockedBookIds = if_not_exists(unlockedBookIds, :emptySet)",
            ExpressionAttributeNames: {
              "#plan": "plan",
            },
            ExpressionAttributeValues: {
              ":proPlan": "PRO",
              ":activeStatus": "active",
              ":flowSource": "flow_points",
              ":periodEnd": params.passExpiresAt ?? now,
              ":nullValue": null,
              ":updatedAt": now,
              ":defaultSlots": 2,
              ":emptySet": new Set<string>(),
            },
          },
        };

  await ddbDoc.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: tableName,
            Key: {
              PK: bookUserPk(params.userId),
              SK: engagementSk(),
            },
            UpdateExpression:
              "SET entity = :entity, userId = :userId, createdAt = if_not_exists(createdAt, :createdAt), updatedAt = :updatedAt ADD points :negativeCost, lifetimeSpent :cost, totalSpendEvents :one",
            ConditionExpression: "attribute_exists(points) AND points >= :cost",
            ExpressionAttributeValues: {
              ":entity": "BOOK_USER_ENGAGEMENT",
              ":userId": params.userId,
              ":createdAt": now,
              ":updatedAt": now,
              ":negativeCost": -costPoints,
              ":cost": costPoints,
              ":one": 1,
            },
          },
        },
        {
          Put: {
            TableName: tableName,
            Item: {
              PK: bookUserPk(params.userId),
              SK: rewardClaimSk(params.rewardId),
              entity: "BOOK_USER_REWARD_CLAIM",
              userId: params.userId,
              rewardId: params.rewardId,
              redemptionId,
              claimedAt: now,
              updatedAt: now,
            },
            ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
          },
        },
        {
          Put: {
            TableName: tableName,
            Item: {
              PK: bookUserPk(params.userId),
              SK: rewardRedemptionSk(now, redemptionId),
              entity: "BOOK_USER_REWARD_REDEMPTION",
              userId: params.userId,
              redemptionId,
              rewardId: params.rewardId,
              costPoints,
              status: "fulfilled",
              metadata: params.metadata ?? {},
              createdAt: now,
              updatedAt: now,
            },
            ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
          },
        },
        {
          Put: {
            TableName: tableName,
            Item: {
              PK: bookUserPk(params.userId),
              SK: flowPointsLedgerSk(now, redemptionId),
              entity: "BOOK_USER_FLOW_POINTS_LEDGER",
              userId: params.userId,
              transactionId: redemptionId,
              direction: "spend",
              amount: costPoints,
              sourceType: "reward_redemption",
              sourceId: params.rewardId,
              rewardId: params.rewardId,
              metadata: params.metadata ?? {},
              createdAt: now,
              updatedAt: now,
            },
            ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
          },
        },
        entitlementUpdate,
      ],
    })
  );

  return {
    state: await getUserFlowPointsState(tableName, params.userId),
    redemptionId,
  };
}

export async function markReferralActivationRewarded(
  tableName: string,
  claim: BookUserReferralClaimItem,
  inviterPoints: number
): Promise<boolean> {
  const now = nowIso();
  try {
    await ddbDoc.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Update: {
              TableName: tableName,
              Key: {
                PK: bookUserPk(claim.userId),
                SK: referralClaimSk(),
              },
              UpdateExpression:
                "SET #status = :status, activationQualifiedAt = if_not_exists(activationQualifiedAt, :now), activationRewardedAt = if_not_exists(activationRewardedAt, :now), updatedAt = :updatedAt",
              ConditionExpression: "attribute_not_exists(activationRewardedAt)",
              ExpressionAttributeNames: {
                "#status": "status",
              },
              ExpressionAttributeValues: {
                ":status": "activated",
                ":now": now,
                ":updatedAt": now,
              },
            },
          },
          {
            Update: {
              TableName: tableName,
              Key: {
                PK: bookUserPk(claim.inviterUserId),
                SK: referralProfileSk(),
              },
              UpdateExpression:
                "SET entity = if_not_exists(entity, :entity), userId = :userId, inviteCode = if_not_exists(inviteCode, :inviteCode), createdAt = if_not_exists(createdAt, :createdAt), updatedAt = :updatedAt ADD pendingInvites :pendingDelta, activatedInvites :activatedDelta, activationPointsEarned :pointsDelta",
              ExpressionAttributeValues: {
                ":entity": "BOOK_USER_REFERRAL_PROFILE",
                ":userId": claim.inviterUserId,
                ":inviteCode": claim.inviteCode,
                ":createdAt": claim.claimedAt,
                ":updatedAt": now,
                ":pendingDelta": -1,
                ":activatedDelta": 1,
                ":pointsDelta": Math.max(0, Math.floor(inviterPoints)),
              },
            },
          },
        ],
      })
    );
    return true;
  } catch (error: unknown) {
    if (isConditionalCheckFailed(error)) return false;
    throw error;
  }
}

export async function markReferralProRewarded(
  tableName: string,
  claim: BookUserReferralClaimItem,
  inviterPoints: number
): Promise<boolean> {
  const now = nowIso();
  try {
    await ddbDoc.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Update: {
              TableName: tableName,
              Key: {
                PK: bookUserPk(claim.userId),
                SK: referralClaimSk(),
              },
              UpdateExpression:
                "SET #status = :status, proRewardedAt = if_not_exists(proRewardedAt, :now), activationQualifiedAt = if_not_exists(activationQualifiedAt, :now), updatedAt = :updatedAt",
              ConditionExpression: "attribute_not_exists(proRewardedAt)",
              ExpressionAttributeNames: {
                "#status": "status",
              },
              ExpressionAttributeValues: {
                ":status": "paid",
                ":now": now,
                ":updatedAt": now,
              },
            },
          },
          {
            Update: {
              TableName: tableName,
              Key: {
                PK: bookUserPk(claim.inviterUserId),
                SK: referralProfileSk(),
              },
              UpdateExpression:
                "SET entity = if_not_exists(entity, :entity), userId = :userId, inviteCode = if_not_exists(inviteCode, :inviteCode), createdAt = if_not_exists(createdAt, :createdAt), updatedAt = :updatedAt ADD proInvites :proDelta, proPointsEarned :pointsDelta",
              ExpressionAttributeValues: {
                ":entity": "BOOK_USER_REFERRAL_PROFILE",
                ":userId": claim.inviterUserId,
                ":inviteCode": claim.inviteCode,
                ":createdAt": claim.claimedAt,
                ":updatedAt": now,
                ":proDelta": 1,
                ":pointsDelta": Math.max(0, Math.floor(inviterPoints)),
              },
            },
          },
        ],
      })
    );
    return true;
  } catch (error: unknown) {
    if (isConditionalCheckFailed(error)) return false;
    throw error;
  }
}
