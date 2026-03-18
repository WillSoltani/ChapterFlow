export function nowIso(): string {
  return new Date().toISOString();
}

export function padVersion(version: number): string {
  return String(Math.max(1, Math.floor(version))).padStart(6, "0");
}

export function padChapterNumber(chapterNumber: number): string {
  return String(Math.max(0, Math.floor(chapterNumber))).padStart(4, "0");
}

export function catalogPk(): string {
  return "BOOKCATALOG";
}

export function catalogSk(bookId: string): string {
  return `BOOK#${bookId}`;
}

export function bookPk(bookId: string): string {
  return `BOOK#${bookId}`;
}

export function bookMetaSk(): string {
  return "META";
}

export function bookVersionSk(version: number): string {
  return `VERSION#${padVersion(version)}`;
}

export function ingestJobPk(jobId: string): string {
  return `BOOKINGEST#${jobId}`;
}

export function ingestJobSk(): string {
  return "JOB";
}

export function bookUserPk(userId: string): string {
  return `BOOKUSER#${userId}`;
}

export function entitlementSk(): string {
  return "ENTITLEMENT";
}

export function progressSk(bookId: string): string {
  return `PROGRESS#${bookId}`;
}

export function profileSk(): string {
  return "PROFILE";
}

export function settingsSk(): string {
  return "SETTINGS";
}

export function savedBookSk(bookId: string): string {
  return `SAVED#${bookId}`;
}

export function bookStateSk(bookId: string): string {
  return `BOOKSTATE#${bookId}`;
}

export function chapterStateSk(bookId: string, chapterNumber: number): string {
  return `CHAPTERSTATE#${bookId}#${padChapterNumber(chapterNumber)}`;
}

export function scenarioSubmissionSk(
  bookId: string,
  chapterNumber: number,
  submissionId: string
): string {
  return `SCENARIO#${bookId}#${padChapterNumber(chapterNumber)}#${submissionId}`;
}

export function scenarioModerationPk(status: "PENDING"): string {
  return `BOOKSCENARIO#${status}`;
}

export function scenarioModerationSk(createdAt: string, submissionId: string): string {
  return `${createdAt}#${submissionId}`;
}

export function scenarioLookupPk(submissionId: string): string {
  return `BOOKSCENARIO#LOOKUP#${submissionId}`;
}

export function scenarioLookupSk(): string {
  return "META";
}

export function approvedScenarioPk(bookId: string, chapterNumber: number): string {
  return `BOOKSCENARIO#APPROVED#${bookId}#${padChapterNumber(chapterNumber)}`;
}

export function approvedScenarioSk(createdAt: string, submissionId: string): string {
  return `${createdAt}#${submissionId}`;
}

export function engagementSk(): string {
  return "ENGAGEMENT";
}

export function readingDaySk(dayKey: string): string {
  return `READINGDAY#${dayKey}`;
}

export function badgeAwardSk(badgeId: string): string {
  return `BADGE#${badgeId}`;
}

export function quizAttemptPk(userId: string, bookId: string, chapterNumber: number): string {
  return `QUIZATTEMPT#${userId}#${bookId}#${padChapterNumber(chapterNumber)}`;
}

export function quizAttemptSk(timestampIso: string): string {
  return timestampIso;
}

export function webhookPk(): string {
  return "BOOKBILLING#WEBHOOK";
}

export function webhookSk(eventId: string): string {
  return `EVENT#${eventId}`;
}

export function stripeCustomerPk(customerId: string): string {
  return `BOOKBILLING#CUSTOMER#${customerId}`;
}

export function stripeCustomerSk(): string {
  return "USER";
}

/** PK for a license key record. Code is stored uppercase for case-insensitive lookups. */
export function licenseKeyPk(code: string): string {
  return `BOOKLICENSE#KEY#${code.toUpperCase()}`;
}

export function licenseKeySk(): string {
  return "META";
}

export function buildContentPrefix(bookId: string, version: number): string {
  return `book-content/books/${bookId}/v${padVersion(version)}`;
}

export function buildManifestKey(prefix: string): string {
  return `${prefix}/manifest.json`;
}

export function buildBookJsonKey(prefix: string): string {
  return `${prefix}/book.json`;
}

export function buildChapterKey(prefix: string, chapterNumber: number): string {
  return `${prefix}/chapters/${padChapterNumber(chapterNumber)}.json`;
}

export function buildQuizKey(prefix: string, chapterNumber: number): string {
  return `${prefix}/quizzes/${padChapterNumber(chapterNumber)}.json`;
}
