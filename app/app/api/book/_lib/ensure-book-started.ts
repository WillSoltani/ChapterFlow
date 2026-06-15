import "server-only";

import type { NextResponse } from "next/server";
import type { AuthedUser } from "@/app/app/api/_lib/auth";
import {
  getBookAnalyticsTableName,
  getBookFreeSlotsDefault,
} from "@/app/app/api/book/_lib/env";
import {
  analyticsTrackFlowPointsTransaction,
  analyticsTrackReferral,
} from "@/app/app/api/book/_lib/analytics-repo";
import {
  applyDeviceIdCookie,
  assertFreeUnlockAllowed,
  recordRiskSignals,
} from "@/app/app/api/book/_lib/abuse";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import {
  awardFlowPoints,
  getUserReferralClaim,
  markReferralActivationBlocked,
  markReferralActivationRewarded,
} from "@/app/app/api/book/_lib/flow-points-repo";
import {
  checkReferralFraud,
  type ReferralFraudCheckResult,
} from "@/app/app/api/book/_lib/referral-fraud";
import { checkReferralEscalation } from "@/app/app/api/book/_lib/referral-escalation";
import { nowIso } from "@/app/app/api/book/_lib/keys";
import {
  createProgressIfMissing,
  getBookVersion,
  getCatalogBook,
  getUserBookState,
  getUserEntitlement,
  getUserProgress,
  reserveBookEntitlement,
  upsertUserProgress,
} from "@/app/app/api/book/_lib/repo";
import { readJsonFromS3 } from "@/app/app/api/book/_lib/storage";
import type {
  BookManifest,
  BookUserEntitlement,
  BookUserBookStateItem,
  BookUserProgress,
} from "@/app/app/api/book/_lib/types";
import { INSIGHT_POINTS_AMOUNTS } from "@/app/book/_lib/flow-points-economy";
import { MONTHLY_PRICE_PER_MONTH } from "@/lib/pricing";

function sortUniqueNumbers(values: number[]): number[] {
  return Array.from(new Set(values.filter((value) => Number.isFinite(value) && value > 0))).sort(
    (left, right) => left - right
  );
}

function isValidIsoTimestamp(value: string | undefined): value is string {
  return Boolean(value && Number.isFinite(new Date(value).getTime()));
}

// Best-effort client IP for referral same-network screening. Mirrors the
// header precedence used by abuse.ts (trusted-edge first). Only used as a
// fraud SIGNAL (never for a paywall/economy decision on its own), so a spoofed
// value can at worst over-flag a referral, not award one.
function readClientIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const cloudfrontViewer = req.headers.get("cloudfront-viewer-address")?.trim();
  if (cloudfrontViewer) {
    const host = cloudfrontViewer.split(":")[0]?.trim();
    if (host) return host;
  }
  return null;
}

function buildProgressFromLegacyState(params: {
  userId: string;
  bookId: string;
  manifest: BookManifest;
  pinnedBookVersion: number;
  contentPrefix: string;
  manifestKey: string;
  bookState: BookUserBookStateItem;
  touchedAt: string;
}): BookUserProgress {
  const chapterNumberById = new Map(
    params.manifest.chapters.map((chapter) => [chapter.chapterId, chapter.number])
  );

  const completedChapters = sortUniqueNumbers(
    params.bookState.completedChapterIds.map(
      (chapterId) => chapterNumberById.get(chapterId) ?? 0
    )
  );
  const unlockedNumbers = sortUniqueNumbers(
    params.bookState.unlockedChapterIds.map(
      (chapterId) => chapterNumberById.get(chapterId) ?? 0
    )
  );
  const currentChapterNumber =
    chapterNumberById.get(params.bookState.currentChapterId) ??
    chapterNumberById.get(params.bookState.lastReadChapterId) ??
    unlockedNumbers[0] ??
    1;
  const unlockedThroughChapterNumber = Math.max(
    1,
    currentChapterNumber,
    ...completedChapters,
    ...unlockedNumbers
  );
  const bestScoreByChapter = Object.fromEntries(
    Object.entries(params.bookState.chapterScores)
      .map(([chapterId, score]) => {
        const chapterNumber = chapterNumberById.get(chapterId);
        return chapterNumber ? [String(chapterNumber), score] : null;
      })
      .filter((entry): entry is [string, number] => Boolean(entry))
  );

  return {
    userId: params.userId,
    bookId: params.bookId,
    pinnedBookVersion: params.pinnedBookVersion,
    contentPrefix: params.contentPrefix,
    manifestKey: params.manifestKey,
    currentChapterNumber,
    unlockedThroughChapterNumber,
    completedChapters,
    bestScoreByChapter,
    lastOpenedAt: isValidIsoTimestamp(params.bookState.lastOpenedAt)
      ? params.bookState.lastOpenedAt
      : params.touchedAt,
    lastActiveAt: params.touchedAt,
    streakDays: 0,
    updatedAt: params.touchedAt,
    createdAt: isValidIsoTimestamp(params.bookState.createdAt)
      ? params.bookState.createdAt
      : params.touchedAt,
  };
}

function touchProgressForInteraction(params: {
  progress: BookUserProgress;
  touchedAt: string;
  interactionChapterNumber?: number;
}): BookUserProgress {
  const { progress, touchedAt, interactionChapterNumber } = params;
  const currentChapterNumber =
    interactionChapterNumber && interactionChapterNumber <= progress.unlockedThroughChapterNumber
      ? Math.max(progress.currentChapterNumber, interactionChapterNumber)
      : progress.currentChapterNumber;

  return {
    ...progress,
    currentChapterNumber,
    lastOpenedAt: touchedAt,
    lastActiveAt: touchedAt,
    updatedAt: touchedAt,
  };
}

export async function ensureUserBookStarted(params: {
  req: Request;
  user: AuthedUser;
  tableName: string;
  contentBucket: string;
  bookId: string;
  interactionChapterNumber?: number;
}): Promise<{
  progress: BookUserProgress;
  entitlement: BookUserEntitlement;
  issuedDeviceId: boolean;
  deviceId: string | null;
}> {
  const { req, user, tableName, contentBucket, bookId, interactionChapterNumber } = params;
  const catalog = await getCatalogBook(tableName, bookId);
  if (!catalog?.currentPublishedVersion || catalog.status !== "PUBLISHED") {
    throw new BookApiError(404, "book_not_found", "Book is not available.");
  }

  const version = await getBookVersion(tableName, bookId, catalog.currentPublishedVersion);
  if (!version) {
    throw new BookApiError(404, "book_version_not_found", "Book version is missing.");
  }

  const freeSlotsDefault = await getBookFreeSlotsDefault();
  const currentEntitlement = await getUserEntitlement(tableName, user.sub);
  const alreadyUnlocked = currentEntitlement?.unlockedBookIds.includes(bookId) ?? false;
  const requiresFreeUnlockGuard =
    !alreadyUnlocked && (currentEntitlement?.plan ?? "FREE") === "FREE";
  let riskDeviceId: string | null = null;
  let issuedDeviceId = false;

  if (requiresFreeUnlockGuard) {
    const assessment = await assertFreeUnlockAllowed(tableName, req, user);
    riskDeviceId = assessment.deviceId;
    issuedDeviceId = assessment.issuedDeviceId;
  }

  let entitlement = currentEntitlement;
  if (!entitlement || (!alreadyUnlocked && entitlement.plan === "FREE")) {
    try {
      entitlement = await reserveBookEntitlement(tableName, {
        userId: user.sub,
        bookId,
        freeSlotsDefault,
      });
    } catch (error: unknown) {
      if (error instanceof BookApiError && error.code === "book_limit_reached") {
        const latestEntitlement = await getUserEntitlement(tableName, user.sub);
        const freeBookSlots = latestEntitlement?.freeBookSlots ?? freeSlotsDefault;
        const unlockedBooksCount = latestEntitlement?.unlockedBookIds.length ?? 0;
        throw new BookApiError(
          402,
          "paywall_book_limit",
          "You have reached your free book limit. Upgrade to Pro to continue.",
          {
            unlockedBooksCount,
            freeBookSlots,
            price: MONTHLY_PRICE_PER_MONTH,
            benefits: [
              "Unlock unlimited books",
              "Keep progress synced across devices",
              "Get access to future advanced modes",
            ],
          }
        );
      }
      throw error;
    }
  }

  if (!entitlement) {
    throw new BookApiError(500, "entitlement_missing", "Could not initialize book access.");
  }

  const touchedAt = nowIso();
  let progress = await getUserProgress(tableName, user.sub, bookId);

  if (!progress) {
    const legacyState = await getUserBookState(tableName, user.sub, bookId);
    const seedProgress =
      legacyState != null
        ? buildProgressFromLegacyState({
            userId: user.sub,
            bookId,
            manifest: await readJsonFromS3<BookManifest>(contentBucket, version.manifestKey),
            pinnedBookVersion: version.version,
            contentPrefix: version.contentPrefix,
            manifestKey: version.manifestKey,
            bookState: legacyState,
            touchedAt,
          })
        : {
            userId: user.sub,
            bookId,
            pinnedBookVersion: version.version,
            contentPrefix: version.contentPrefix,
            manifestKey: version.manifestKey,
            currentChapterNumber: 1,
            unlockedThroughChapterNumber: 1,
            completedChapters: [],
            bestScoreByChapter: {},
            lastOpenedAt: touchedAt,
            lastActiveAt: touchedAt,
            streakDays: 0,
            updatedAt: touchedAt,
            createdAt: touchedAt,
          };

    await createProgressIfMissing(tableName, seedProgress);
    progress = await getUserProgress(tableName, user.sub, bookId);
  }

  if (!progress) {
    throw new BookApiError(500, "progress_init_failed", "Could not initialize progress.");
  }

  const nextProgress = touchProgressForInteraction({
    progress,
    touchedAt,
    interactionChapterNumber,
  });
  await upsertUserProgress(tableName, nextProgress);

  if (requiresFreeUnlockGuard) {
    await recordRiskSignals(tableName, req, user, "free_unlock_granted", {
      deviceId: riskDeviceId ?? undefined,
    }).catch(() => null);
  }

  const firstBookAward = await awardFlowPoints(tableName, {
    userId: user.sub,
    amount: INSIGHT_POINTS_AMOUNTS.firstBookStarted,
    sourceType: "first_book_started",
    sourceId: "primary",
    metadata: {
      bookId,
      bookTitle: catalog.title,
    },
  });

  const referralClaim = await getUserReferralClaim(tableName, user.sub);
  let inviterAwarded = false;
  let inviteeAwarded = false;

  if (referralClaim && !referralClaim.activationRewardedAt) {
    // §6.6 — Fraud-screen before paying out 180 IP (inviter) + 80 IP (invitee).
    // Without this, throwaway accounts can farm the IP economy (and IP buys Pro).
    // Fail OPEN on a check error (award + flag) so a transient DB blip never
    // denies a legitimate referral; the award's own grant key stays idempotent.
    const fraud = await checkReferralFraud({
      tableName,
      inviteeUserId: user.sub,
      inviterUserId: referralClaim.inviterUserId,
      inviteeEmail: user.email ?? "",
      inviteeDeviceId: riskDeviceId,
      inviterDeviceId: null,
      inviteeIp: readClientIp(req),
      inviterIp: null,
    }).catch(
      (): ReferralFraudCheckResult => ({
        allowed: true,
        flagForReview: true,
        reason: "fraud_check_error",
      })
    );

    if (fraud.allowed) {
      const [inviterAward, inviteeAward] = await Promise.all([
        awardFlowPoints(tableName, {
          userId: referralClaim.inviterUserId,
          amount: INSIGHT_POINTS_AMOUNTS.referralActivationInviter,
          sourceType: "referral_activation_inviter",
          sourceId: referralClaim.claimId,
          metadata: {
            inviteCode: referralClaim.inviteCode,
            referredUserId: user.sub,
          },
        }),
        awardFlowPoints(tableName, {
          userId: user.sub,
          amount: INSIGHT_POINTS_AMOUNTS.referralActivationInvitee,
          sourceType: "referral_activation_invitee",
          sourceId: referralClaim.claimId,
          metadata: {
            inviteCode: referralClaim.inviteCode,
            inviterUserId: referralClaim.inviterUserId,
          },
        }),
      ]);
      inviterAwarded = inviterAward.awarded;
      inviteeAwarded = inviteeAward.awarded;
      const activationRecorded = await markReferralActivationRewarded(
        tableName,
        referralClaim,
        INSIGHT_POINTS_AMOUNTS.referralActivationInviter
      ).catch(() => false);

      // §6.3 — Referral escalation tiers (3/5/10/25 activations → 4,600 IP +
      // exclusive frame/theme/badge). markReferralActivationRewarded just
      // ADD-incremented the inviter's activatedInvites, and checkReferralEscalation
      // reads that counter, so it MUST run after it. Gate on activationRecorded so
      // a duplicate/raced call (which did NOT move the count here) doesn't re-run
      // it. Best-effort: an escalation failure must never block the book-start.
      if (activationRecorded) {
        const inviterEntitlement = await getUserEntitlement(
          tableName,
          referralClaim.inviterUserId
        );
        await checkReferralEscalation(
          tableName,
          referralClaim.inviterUserId,
          inviterEntitlement?.plan ?? "FREE"
        ).catch(() => null);
      }
    } else {
      // Fraud detected — consume the claim (so it isn't retried) WITHOUT crediting
      // the inviter. inviterAwarded/inviteeAwarded stay false, so the analytics
      // block below skips the referral-earn events too.
      await markReferralActivationBlocked(tableName, referralClaim, fraud.reason).catch(
        () => false
      );
    }
  }

  getBookAnalyticsTableName()
    .then((analyticsTable) => {
      if (!analyticsTable) return;
      const analyticsTasks: Promise<unknown>[] = [];
      if (firstBookAward.awarded) {
        analyticsTasks.push(
          analyticsTrackFlowPointsTransaction(analyticsTable, {
            userId: user.sub,
            deltaPoints: INSIGHT_POINTS_AMOUNTS.firstBookStarted,
            direction: "earn",
            sourceType: "first_book_started",
            sourceId: "primary",
            metadata: {
              bookId,
              bookTitle: catalog.title,
            },
          })
        );
      }
      if (referralClaim && inviterAwarded) {
        analyticsTasks.push(
          analyticsTrackFlowPointsTransaction(analyticsTable, {
            userId: referralClaim.inviterUserId,
            deltaPoints: INSIGHT_POINTS_AMOUNTS.referralActivationInviter,
            direction: "earn",
            sourceType: "referral_activation_inviter",
            sourceId: referralClaim.claimId,
            metadata: {
              inviteCode: referralClaim.inviteCode,
              referredUserId: user.sub,
            },
          }),
          analyticsTrackReferral(analyticsTable, {
            userId: referralClaim.inviterUserId,
            eventType: "referral_activated",
            inviteCode: referralClaim.inviteCode,
            referredUserId: user.sub,
            pointsAwarded: INSIGHT_POINTS_AMOUNTS.referralActivationInviter,
          })
        );
      }
      if (referralClaim && inviteeAwarded) {
        analyticsTasks.push(
          analyticsTrackFlowPointsTransaction(analyticsTable, {
            userId: user.sub,
            deltaPoints: INSIGHT_POINTS_AMOUNTS.referralActivationInvitee,
            direction: "earn",
            sourceType: "referral_activation_invitee",
            sourceId: referralClaim.claimId,
            metadata: {
              inviteCode: referralClaim.inviteCode,
              inviterUserId: referralClaim.inviterUserId,
            },
          })
        );
      }
      return Promise.allSettled(analyticsTasks);
    })
    .catch(() => {});

  return {
    progress: nextProgress,
    entitlement,
    issuedDeviceId,
    deviceId: riskDeviceId,
  };
}

export function applyStartDeviceCookie<T>(
  response: NextResponse<T>,
  params: { issuedDeviceId: boolean; deviceId: string | null }
) {
  if (params.issuedDeviceId && params.deviceId) {
    applyDeviceIdCookie(response, params.deviceId, true);
  }
  return response;
}
