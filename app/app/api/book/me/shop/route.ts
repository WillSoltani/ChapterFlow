import "server-only";

// Implements §5.1 — Personalization purchases (themes, frames, Gift a Friend).
// Handles repeatable and non-repeatable items, tier-gated access.
// Separate from the bridge redemption endpoint (flow-points/redeem) which
// handles the 3 preserved freeOnly sinks.

import { GetCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { requireActiveBookUser } from "@/app/app/api/book/_lib/account-guard";
import {
  getBookAnalyticsTableName,
  getBookTableName,
} from "@/app/app/api/book/_lib/env";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import {
  bookOk,
  requireBodyObject,
  requireString,
  withBookApiErrors,
} from "@/app/app/api/book/_lib/http";
import {
  bookUserPk,
  engagementSk,
  flowPointsLedgerSk,
  giftCodePk,
  giftCodeSk,
  inventorySk,
  nowIso,
  tierSk,
} from "@/app/app/api/book/_lib/keys";
import { getUserFlowPointsState } from "@/app/app/api/book/_lib/flow-points-repo";
import { analyticsTrackFlowPointsTransaction } from "@/app/app/api/book/_lib/analytics-repo";
import { ddbDoc } from "@/app/app/api/_lib/aws";
import {
  getPersonalizationItem,
  GIFT_A_FRIEND,
  meetsTeamGate,
} from "@/app/book/_lib/personalization-catalog";
import type { TierName } from "@/app/app/api/book/_lib/types";

export const runtime = "nodejs";

/**
 * Generate a CSPRNG-backed gift code with a non-ambiguous alphabet.
 * 20 chars over a 32-symbol alphabet = 100 bits of entropy (well above the
 * ~96-bit target), defeating online enumeration of claimable Pro grants.
 * The 32-char alphabet is a power of two, so masking each random byte with
 * & 31 maps it onto the alphabet uniformly — no modulo bias. Mirrors the
 * generator in pair-repo.ts, using the global Web Crypto already relied on
 * elsewhere in this file (crypto.randomUUID).
 */
function generateGiftCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  let code = "";
  for (let i = 0; i < bytes.length; i++) {
    code += chars[bytes[i] & 31];
  }
  return `GIFT-${code}`;
}

/** GET — List available shop items with user's inventory and tier context */
export async function GET(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireActiveBookUser();
    const tableName = await getBookTableName();

    // Fetch tier for gate checks
    const tierRes = await ddbDoc.send(
      new GetCommand({
        TableName: tableName,
        Key: { PK: bookUserPk(user.sub), SK: tierSk() },
        ProjectionExpression: "currentTier",
      })
    );
    const currentTier = ((tierRes.Item?.currentTier as string) ?? "reader") as TierName;

    const state = await getUserFlowPointsState(tableName, user.sub);

    // Import at call time to avoid circular deps
    const { PERSONALIZATION_CATALOG } = await import("@/app/book/_lib/personalization-catalog");

    const items = PERSONALIZATION_CATALOG.map((item) => {
      const meetsTier = meetsTeamGate(currentTier, item.tierGate);
      return {
        id: item.id,
        name: item.name,
        description: item.description,
        type: item.type,
        ipCost: item.ipCost,
        tierGate: item.tierGate,
        meetsTierGate: meetsTier,
        affordable: state.points >= item.ipCost,
      };
    });

    return bookOk({
      items,
      giftAFriend: {
        ...GIFT_A_FRIEND,
        affordable: state.points >= GIFT_A_FRIEND.ipCost,
      },
      balance: state.points,
      currentTier,
    });
  });
}

/** POST — Purchase a personalization item or Gift a Friend */
export async function POST(req: Request) {
  return withBookApiErrors(req, async () => {
    const user = await requireActiveBookUser();
    let bodyRaw: unknown;
    try {
      bodyRaw = await req.json();
    } catch {
      bodyRaw = {};
    }
    const body = requireBodyObject(bodyRaw);
    const itemId = requireString(body.itemId, "itemId", { maxLength: 100 });

    const tableName = await getBookTableName();
    const now = nowIso();
    const transactionId = crypto.randomUUID();

    // ── Gift a Friend ──────────────────────────────────────────────────
    if (itemId === GIFT_A_FRIEND.id) {
      const cost = GIFT_A_FRIEND.ipCost;

      // Generate the gift code up front so it can be persisted in the SAME
      // transaction as the IP deduction — both commit or neither does, so the
      // user can never be debited without receiving a code (and vice versa).
      const giftCode = generateGiftCode();

      // Atomic: deduct IP + record ledger entry + persist the gift code.
      try {
        await ddbDoc.send(
          new TransactWriteCommand({
            TransactItems: [
              {
                Update: {
                  TableName: tableName,
                  Key: { PK: bookUserPk(user.sub), SK: engagementSk() },
                  UpdateExpression:
                    "SET updatedAt = :now ADD points :negativeCost, lifetimeSpent :cost, totalSpendEvents :one",
                  ConditionExpression: "attribute_exists(points) AND points >= :cost",
                  ExpressionAttributeValues: {
                    ":now": now,
                    ":negativeCost": -cost,
                    ":cost": cost,
                    ":one": 1,
                  },
                },
              },
              {
                Put: {
                  TableName: tableName,
                  Item: {
                    PK: bookUserPk(user.sub),
                    SK: flowPointsLedgerSk(now, transactionId),
                    entity: "BOOK_USER_FLOW_POINTS_LEDGER",
                    userId: user.sub,
                    transactionId,
                    direction: "spend",
                    amount: cost,
                    sourceType: "reward_redemption",
                    sourceId: GIFT_A_FRIEND.id,
                    metadata: { rewardName: GIFT_A_FRIEND.name },
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
                    PK: giftCodePk(),
                    SK: giftCodeSk(giftCode),
                    entity: "BOOK_USER_GIFT_CODE",
                    code: giftCode,
                    giverUserId: user.sub,
                    giftType: "pro_week",
                    ipCost: cost,
                    status: "available",
                    createdAt: now,
                  },
                  ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
                },
              },
            ],
          })
        );
      } catch (error: unknown) {
        if (error && typeof error === "object" && (error as Record<string, unknown>).name === "TransactionCanceledException") {
          throw new BookApiError(400, "insufficient_points", "Insufficient Insight Points balance.");
        }
        throw error;
      }

      // Fire-and-forget analytics
      getBookAnalyticsTableName()
        .then((at) => {
          if (!at) return;
          return analyticsTrackFlowPointsTransaction(at, {
            userId: user.sub,
            deltaPoints: -cost,
            direction: "spend",
            sourceType: "reward_redemption",
            sourceId: GIFT_A_FRIEND.id,
            metadata: { rewardName: GIFT_A_FRIEND.name, giftCode },
          });
        })
        .catch(() => {});

      const state = await getUserFlowPointsState(tableName, user.sub);
      return bookOk({
        ok: true,
        itemId: GIFT_A_FRIEND.id,
        balance: state.points,
        giftCode,
        message: "Gift purchased! Share the code with a friend to give them a free week of Pro.",
      });
    }

    // ── Personalization item ───────────────────────────────────────────
    const item = getPersonalizationItem(itemId);
    if (!item) {
      throw new BookApiError(400, "invalid_item", "Item not found in the shop catalog.");
    }

    // Tier gate check
    if (item.tierGate) {
      const tierRes = await ddbDoc.send(
        new GetCommand({
          TableName: tableName,
          Key: { PK: bookUserPk(user.sub), SK: tierSk() },
          ProjectionExpression: "currentTier",
        })
      );
      const currentTier = ((tierRes.Item?.currentTier as string) ?? "reader") as TierName;
      if (!meetsTeamGate(currentTier, item.tierGate)) {
        throw new BookApiError(
          400,
          "tier_required",
          `You need to reach ${item.tierGate} tier to purchase this item.`
        );
      }
    }

    // One-time check: see if already owned
    if (item.oneTimePerUser) {
      const existing = await ddbDoc.send(
        new GetCommand({
          TableName: tableName,
          Key: {
            PK: bookUserPk(user.sub),
            SK: inventorySk(item.type, item.id),
          },
          ProjectionExpression: "PK",
        })
      );
      if (existing.Item) {
        throw new BookApiError(400, "already_owned", "You already own this item.");
      }
    }

    const cost = item.ipCost;

    // Atomic: deduct IP + create inventory record + ledger entry
    try {
      await ddbDoc.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Update: {
                TableName: tableName,
                Key: { PK: bookUserPk(user.sub), SK: engagementSk() },
                UpdateExpression:
                  "SET updatedAt = :now ADD points :negativeCost, lifetimeSpent :cost, totalSpendEvents :one",
                ConditionExpression: "attribute_exists(points) AND points >= :cost",
                ExpressionAttributeValues: {
                  ":now": now,
                  ":negativeCost": -cost,
                  ":cost": cost,
                  ":one": 1,
                },
              },
            },
            {
              Put: {
                TableName: tableName,
                Item: {
                  PK: bookUserPk(user.sub),
                  SK: inventorySk(item.type, item.id),
                  entity: "BOOK_USER_INVENTORY",
                  userId: user.sub,
                  itemId: item.id,
                  itemType: item.type,
                  acquiredAt: now,
                  equipped: false,
                  ipCost: cost,
                  createdAt: now,
                },
                ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
              },
            },
            {
              Put: {
                TableName: tableName,
                Item: {
                  PK: bookUserPk(user.sub),
                  SK: flowPointsLedgerSk(now, transactionId),
                  entity: "BOOK_USER_FLOW_POINTS_LEDGER",
                  userId: user.sub,
                  transactionId,
                  direction: "spend",
                  amount: cost,
                  sourceType: "reward_redemption",
                  sourceId: item.id,
                  metadata: { rewardName: item.name, itemType: item.type },
                  createdAt: now,
                  updatedAt: now,
                },
                ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)",
              },
            },
          ],
        })
      );
    } catch (error: unknown) {
      if (error && typeof error === "object" && (error as Record<string, unknown>).name === "TransactionCanceledException") {
        throw new BookApiError(400, "insufficient_points", "Insufficient Insight Points balance.");
      }
      throw error;
    }

    // Fire-and-forget analytics
    getBookAnalyticsTableName()
      .then((at) => {
        if (!at) return;
        return analyticsTrackFlowPointsTransaction(at, {
          userId: user.sub,
          deltaPoints: -cost,
          direction: "spend",
          sourceType: "reward_redemption",
          sourceId: item.id,
          metadata: { rewardName: item.name, itemType: item.type },
        });
      })
      .catch(() => {});

    const state = await getUserFlowPointsState(tableName, user.sub);
    return bookOk({
      ok: true,
      itemId: item.id,
      balance: state.points,
      message: `${item.name} acquired! You can equip it from your profile settings.`,
    });
  });
}
