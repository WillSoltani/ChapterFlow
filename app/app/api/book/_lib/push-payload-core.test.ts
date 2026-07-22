import { test } from "node:test";
import assert from "node:assert/strict";
import {
  routeSpecFor,
  buildApnsPayload,
  buildWebPushPayload,
  apnsRequestHeaders,
  apnsJwtClaims,
  fitBody,
  MAX_PUSH_PAYLOAD_BYTES,
  type PushNotificationType,
} from "./push-payload-core";

// Every documented type produces a chapterflow:// route, a web path, a category
// and a thread — the contract iOS relies on.
const ALL_TYPES: PushNotificationType[] = [
  "badge_earned",
  "tier_up",
  "streak_milestone",
  "insight_spark",
  "reading_reminder",
  "streak_at_risk",
  "partner_nudge",
  "commitment_followup",
  "event_reminder",
  "scenario_approved",
  "scenario_rejected",
];

test("every documented type yields a chapterflow:// route + non-empty spec", () => {
  for (const type of ALL_TYPES) {
    const spec = routeSpecFor(type);
    assert.ok(spec.route.startsWith("chapterflow://"), `${type} route`);
    assert.ok(spec.webPath.startsWith("/"), `${type} webPath`);
    assert.ok(spec.category.length > 0, `${type} category`);
    assert.ok(spec.threadId.length > 0, `${type} threadId`);
  }
});

test("unknown type falls back to the notifications inbox (no dead link)", () => {
  const spec = routeSpecFor("weekly_digest");
  assert.equal(spec.route, "chapterflow://notifications");
});

test("badge_earned routes by which id the metadata carries", () => {
  assert.equal(
    routeSpecFor("badge_earned", { journeyId: "j1" }).route,
    "chapterflow://journeys/j1",
  );
  assert.equal(
    routeSpecFor("badge_earned", { eventId: "e1", badgeId: "b1" }).route,
    "chapterflow://events/e1",
  );
  const plain = routeSpecFor("badge_earned", { achievementId: "a1", ip: 50 });
  assert.equal(plain.route, "chapterflow://progress/achievements");
  assert.equal(plain.data.achievementId, "a1");
  assert.equal(plain.data.ip, 50);
});

test("commitment_followup embeds the commitmentId in the deep link + data", () => {
  const spec = routeSpecFor("commitment_followup", { commitmentId: "c1", bookId: "atomic-habits" });
  assert.equal(spec.route, "chapterflow://commitments/c1");
  assert.equal(spec.data.commitmentId, "c1");
  assert.equal(spec.data.bookId, "atomic-habits");
});

test("scenario_approved/rejected route to the submission", () => {
  assert.equal(
    routeSpecFor("scenario_approved", { submissionId: "s1", ip: 20 }).route,
    "chapterflow://scenarios/s1",
  );
  assert.equal(
    routeSpecFor("scenario_rejected", { submissionId: "s2" }).route,
    "chapterflow://scenarios/s2",
  );
});

test("streak_at_risk is high priority; reminders collapse", () => {
  assert.equal(routeSpecFor("streak_at_risk").priority, 10);
  assert.equal(routeSpecFor("reading_reminder").collapseId, "reading-reminder");
  assert.equal(routeSpecFor("tier_up").collapseId, "tier-up");
});

test("buildApnsPayload emits the aps dictionary + custom { type, route, data }", () => {
  const payload = buildApnsPayload({
    type: "streak_milestone",
    title: "7-Day Streak!",
    body: "You've maintained a 7-day reading streak! +50 IP",
    metadata: { days: 7, ip: 50 },
    badge: 3,
  });
  assert.deepEqual(payload.aps.alert, { title: "7-Day Streak!", body: "You've maintained a 7-day reading streak! +50 IP" });
  assert.equal(payload.aps.badge, 3);
  assert.equal(payload.aps.sound, "default");
  assert.equal(payload.aps.category, "STREAK");
  assert.equal(payload.aps["thread-id"], "streak");
  assert.equal(payload.aps["mutable-content"], 1);
  assert.equal(payload.type, "streak_milestone");
  assert.equal(payload.route, "chapterflow://progress/streak");
  assert.deepEqual(payload.data, { days: 7, ip: 50 });
});

test("badge is omitted when not supplied and clamped to an int when supplied", () => {
  const noBadge = buildApnsPayload({ type: "tier_up", title: "t", body: "b" });
  assert.ok(!("badge" in noBadge.aps));
  const withBadge = buildApnsPayload({ type: "tier_up", title: "t", body: "b", badge: 4.9 });
  assert.equal(withBadge.aps.badge, 4);
});

test("web-push payload keeps the sw.js contract (title/body/url) + adds type/route", () => {
  const payload = buildWebPushPayload({
    type: "reading_reminder",
    title: "Time to read!",
    body: "A few minutes of focused reading can make a real difference.",
  });
  assert.equal(payload.title, "Time to read!");
  assert.ok(typeof payload.body === "string");
  assert.equal(payload.url, "/book/library");
  assert.equal(payload.type, "reading_reminder");
  assert.equal(payload.route, "chapterflow://home");
});

test("payloads stay under 4KB; an oversized body is truncated", () => {
  const huge = "x".repeat(10_000);
  const payload = buildApnsPayload({ type: "badge_earned", title: "Achievement", body: huge });
  const bytes = Buffer.byteLength(JSON.stringify(payload), "utf8");
  assert.ok(bytes <= MAX_PUSH_PAYLOAD_BYTES, `payload is ${bytes} bytes`);
  assert.ok(payload.aps.alert.body.length < huge.length, "body was truncated");
});

test("fitBody leaves a small body untouched", () => {
  const make = (b: string) => ({ b });
  const r = fitBody(make, "short");
  assert.equal(r.body, "short");
  assert.ok(r.bytes <= MAX_PUSH_PAYLOAD_BYTES);
});

test("apnsRequestHeaders sets topic=bundle, push-type, priority, collapse-id", () => {
  const spec = routeSpecFor("streak_at_risk");
  const headers = apnsRequestHeaders({ bundleId: "ca.chapterflow.app", spec });
  assert.equal(headers["apns-topic"], "ca.chapterflow.app");
  assert.equal(headers["apns-push-type"], "alert");
  assert.equal(headers["apns-priority"], "10");
  assert.equal(headers["apns-collapse-id"], "streak-at-risk");

  // No collapse id for celebrations that must never coalesce.
  const badge = apnsRequestHeaders({ bundleId: "ca.chapterflow.app", spec: routeSpecFor("badge_earned") });
  assert.ok(!("apns-collapse-id" in badge));
});

test("apns-collapse-id is capped at 64 bytes", () => {
  const spec = { ...routeSpecFor("event_reminder", { eventId: "e" }), collapseId: "z".repeat(200) };
  const headers = apnsRequestHeaders({ bundleId: "b", spec });
  assert.ok(headers["apns-collapse-id"]!.length <= 64);
});

test("apnsJwtClaims returns the ES256 header + iss/iat payload", () => {
  const claims = apnsJwtClaims({ keyId: "KEY123", teamId: "TEAM456", iatSeconds: 1_700_000_000.7 });
  assert.deepEqual(claims.header, { alg: "ES256", kid: "KEY123" });
  assert.deepEqual(claims.payload, { iss: "TEAM456", iat: 1_700_000_000 });
});
