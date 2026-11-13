import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LOCAL_USER_DATA_OWNER_KEY,
  clearPersonalStorage,
  isPersonalStorageKey,
  ownerFromCookieHeader,
  reconcileLocalUserDataOwner,
  type StorageLike,
} from "./local-user-data";

class MemoryStorage implements StorageLike {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  getItem(key: string) {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, String(value));
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  keys() {
    return [...this.map.keys()].sort();
  }
}

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";

function seedUserA(local: MemoryStorage, session: MemoryStorage) {
  local.setItem("book-accelerator:profile:v1", JSON.stringify({ name: "A", email: "a@x" }));
  local.setItem("book-accelerator:chapter-reader:v1:atomic-habits:ch1", '{"notes":"A private"}');
  local.setItem("book-accelerator:book-progress:v3:atomic-habits", '{"completed":["ch1"]}');
  local.setItem("book-accelerator:preferences:v2", '{"appearance":{"theme":"dark"}}');
  local.setItem("book-accelerator:onboarding:v5", '{"setupComplete":true}');
  local.setItem("chapterflow_onboarding", "{}");
  local.setItem("quiz-draft:atomic-habits:1:standard", "{}");
  local.setItem("cf:badge-showcase-v1", "[]");
  local.setItem("cf-impl-checks-ch1", "[]");
  local.setItem("cf:auth-generation", USER_A);
  local.setItem("unrelated-site-key", "keep");
  session.setItem("ask-book-chat:atomic-habits", "[]");
  session.setItem("cf:billing-upgraded", "1");
}

test("user A's notes, profile and progress are gone when user B signs in", () => {
  const local = new MemoryStorage();
  const session = new MemoryStorage();
  assert.equal(reconcileLocalUserDataOwner([local, session], USER_A), "claimed");
  seedUserA(local, session);

  assert.equal(reconcileLocalUserDataOwner([local, session], USER_B), "cleared");
  assert.deepEqual(local.keys(), [
    "cf:auth-generation",
    LOCAL_USER_DATA_OWNER_KEY,
    "unrelated-site-key",
  ]);
  assert.equal(local.getItem(LOCAL_USER_DATA_OWNER_KEY), USER_B);
  assert.deepEqual(session.keys(), [LOCAL_USER_DATA_OWNER_KEY]);
});

test("a tab's session data is cleared even after another tab re-owned localStorage", () => {
  const local = new MemoryStorage();
  const tabOfA = new MemoryStorage();
  const tabOfB = new MemoryStorage();
  reconcileLocalUserDataOwner([local, tabOfA], USER_A);
  tabOfA.setItem("ask-book-chat:atomic-habits", '[{"q":"A asked"}]');
  // B signs in in another tab first.
  reconcileLocalUserDataOwner([local, tabOfB], USER_B);
  // A's old tab reloads under B's session.
  assert.equal(reconcileLocalUserDataOwner([local, tabOfA], USER_B), "cleared");
  assert.equal(tabOfA.getItem("ask-book-chat:atomic-habits"), null);
});

test("the same account keeps its local data", () => {
  const local = new MemoryStorage();
  const session = new MemoryStorage();
  reconcileLocalUserDataOwner([local, session], USER_A);
  seedUserA(local, session);
  assert.equal(reconcileLocalUserDataOwner([local, session], USER_A), "same");
  assert.equal(local.getItem("book-accelerator:profile:v1") !== null, true);
});

test("data from before owner records existed is kept and claimed, not wiped", () => {
  const local = new MemoryStorage();
  const session = new MemoryStorage();
  seedUserA(local, session);
  // No owner record yet: the first account seen claims the data, so shipping
  // this check does not wipe every reader's device-only data once.
  assert.equal(reconcileLocalUserDataOwner([local, session], USER_A), "claimed");
  assert.equal(local.getItem("book-accelerator:profile:v1") !== null, true);
  assert.equal(local.getItem("quiz-draft:atomic-habits:1:standard") !== null, true);
  assert.equal(session.getItem("ask-book-chat:atomic-habits") !== null, true);
  assert.equal(local.getItem(LOCAL_USER_DATA_OWNER_KEY), USER_A);
  assert.equal(session.getItem(LOCAL_USER_DATA_OWNER_KEY), USER_A);
  // From then on a different account clears it.
  assert.equal(reconcileLocalUserDataOwner([local, session], USER_B), "cleared");
  assert.equal(local.getItem("book-accelerator:profile:v1"), null);
  assert.equal(session.getItem("ask-book-chat:atomic-habits"), null);
  assert.equal(local.getItem(LOCAL_USER_DATA_OWNER_KEY), USER_B);
});

test("an unknown current account changes nothing", () => {
  const local = new MemoryStorage();
  const session = new MemoryStorage();
  seedUserA(local, session);
  assert.equal(reconcileLocalUserDataOwner([local, session], null), "unknown");
  assert.equal(local.getItem("book-accelerator:profile:v1") !== null, true);
});

test("logout clears personal data and the owner record", () => {
  const local = new MemoryStorage();
  const session = new MemoryStorage();
  reconcileLocalUserDataOwner([local, session], USER_A);
  seedUserA(local, session);
  clearPersonalStorage([local, session], { forgetOwner: true });
  assert.deepEqual(local.keys(), ["cf:auth-generation", "unrelated-site-key"]);
  assert.deepEqual(session.keys(), []);
});

test("personal key classification", () => {
  assert.equal(isPersonalStorageKey("book-accelerator:viewer:v1"), true);
  assert.equal(isPersonalStorageKey("celebrated_atomic-habits"), true);
  assert.equal(isPersonalStorageKey("badge_dismissed_first-chapter"), true);
  assert.equal(isPersonalStorageKey("cf:auth-generation"), false);
  assert.equal(isPersonalStorageKey(LOCAL_USER_DATA_OWNER_KEY), false);
  assert.equal(isPersonalStorageKey("something-else"), false);
});

test("the owner is the account, so signing in again as the same account keeps its data", () => {
  const ACCOUNT = "0123456789abcdef0123456789abcdef";
  const GEN_1 = "11111111-1111-4111-8111-111111111111";
  const GEN_2 = "22222222-2222-4222-8222-222222222222";
  const beforeReauth = ownerFromCookieHeader(
    `a=1; cf_auth_generation=${GEN_1}; cf_data_owner=${ACCOUNT}; b=2`,
  );
  const afterReauth = ownerFromCookieHeader(
    `cf_auth_generation=${GEN_2}; cf_data_owner=${ACCOUNT}`,
  );
  assert.equal(beforeReauth, ACCOUNT);
  assert.equal(afterReauth, ACCOUNT);

  const local = new MemoryStorage();
  const session = new MemoryStorage();
  reconcileLocalUserDataOwner([local, session], beforeReauth);
  seedUserA(local, session);
  assert.equal(reconcileLocalUserDataOwner([local, session], afterReauth), "same");
  assert.notEqual(local.getItem("quiz-draft:atomic-habits:1:standard"), null);
});

test("without an account owner cookie the owner is unknown", () => {
  assert.equal(
    ownerFromCookieHeader("cf_auth_generation=11111111-1111-4111-8111-111111111111"),
    null,
  );
  assert.equal(ownerFromCookieHeader("cf_data_owner=not-a-digest"), null);
  assert.equal(ownerFromCookieHeader(""), null);
});
