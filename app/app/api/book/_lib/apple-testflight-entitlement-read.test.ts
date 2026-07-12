import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { installServerOnlyShim } from "@/tests/_lib/server-only-shim";
import { shouldBlockStripeCheckout } from "./stripe-checkout-entitlement-core";
import { hashAppleTestFlightSubject } from "./apple-testflight-subject-hash-core";

type RepoModule = typeof import("./repo");
type AwsModule = typeof import("@/app/app/api/_lib/aws");

const QA_USER = "8f14e45f-ea4f-4a1b-8c32-07bbf1cdb22f";
let repo: RepoModule;
let aws: AwsModule;
let originalSend: typeof aws.ddbDoc.send;

before(async () => {
  const restore = installServerOnlyShim();
  repo = await import("./repo");
  aws = await import("@/app/app/api/_lib/aws");
  restore();
  originalSend = aws.ddbDoc.send.bind(aws.ddbDoc);
});

after(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (aws.ddbDoc as any).send = originalSend;
});

async function withTestFlightEnv<T>(
  enabled: boolean,
  operation: () => Promise<T>,
  deploymentEnvironment = "prod",
): Promise<T> {
  const names = [
    "CHAPTERFLOW_ENV",
    "APPLE_IAP_TESTFLIGHT_SANDBOX_ENABLED",
    "APPLE_IAP_TESTFLIGHT_QA_USER_HASHES",
  ] as const;
  const saved = new Map(names.map((name) => [name, process.env[name]]));
  process.env.CHAPTERFLOW_ENV = deploymentEnvironment;
  process.env.APPLE_IAP_TESTFLIGHT_SANDBOX_ENABLED = enabled ? "1" : "0";
  if (enabled) {
    process.env.APPLE_IAP_TESTFLIGHT_QA_USER_HASHES =
      hashAppleTestFlightSubject(QA_USER);
  } else {
    delete process.env.APPLE_IAP_TESTFLIGHT_QA_USER_HASHES;
  }
  try {
    return await operation();
  } finally {
    for (const name of names) {
      const value = saved.get(name);
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

function productionItem() {
  return {
    plan: "FREE",
    proStatus: "inactive",
    freeBookSlots: 3,
    unlockedBookIds: new Set(["production-book"]),
    stripeCustomerId: "cus_production",
    updatedAt: "2027-01-01T00:00:00.000Z",
  };
}

function sandboxItem() {
  return {
    plan: "PRO",
    proStatus: "active",
    proSource: "apple",
    freeBookSlots: 2,
    unlockedBookIds: new Set<string>(),
    currentPeriodEnd: "2099-01-01T00:00:00.000Z",
    appleOriginalTransactionId: "sandbox-original",
    updatedAt: "2027-01-02T00:00:00.000Z",
  };
}

test("default /me and gated reads use the allowlisted Sandbox overlay", async () => {
  const sortKeys: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (aws.ddbDoc as any).send = async (command: { input: { Key: { SK: string } } }) => {
    const sortKey = command.input.Key.SK;
    sortKeys.push(sortKey);
    return {
      Item:
        sortKey === "ENTITLEMENT#APPLE_SANDBOX"
          ? sandboxItem()
          : productionItem(),
    };
  };

  const effective = await withTestFlightEnv(true, () =>
    repo.getUserEntitlement("ChapterFlow-test", QA_USER, {
      consistentRead: true,
    }),
  );

  assert.deepEqual(sortKeys, ["ENTITLEMENT", "ENTITLEMENT#APPLE_SANDBOX"]);
  assert.equal(effective?.plan, "PRO");
  assert.equal(effective?.proSource, "apple");
  assert.deepEqual(effective?.unlockedBookIds, ["production-book"]);
  assert.equal(effective?.stripeCustomerId, "cus_production");
  assert.equal(
    shouldBlockStripeCheckout(effective),
    true,
    "a normal gated route must receive the same effective Pro decision",
  );
});

test("rollback flag hides the Sandbox row from every default read", async () => {
  const sortKeys: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (aws.ddbDoc as any).send = async (command: { input: { Key: { SK: string } } }) => {
    sortKeys.push(command.input.Key.SK);
    return { Item: productionItem() };
  };

  const effective = await withTestFlightEnv(false, () =>
    repo.getUserEntitlement("ChapterFlow-test", QA_USER),
  );

  assert.deepEqual(sortKeys, ["ENTITLEMENT"]);
  assert.equal(effective?.plan, "FREE");
});

test("ordinary staging default reads use the Primary entitlement row", async () => {
  const sortKeys: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (aws.ddbDoc as any).send = async (command: { input: { Key: { SK: string } } }) => {
    sortKeys.push(command.input.Key.SK);
    return { Item: { ...sandboxItem(), currentPeriodEnd: "2099-01-01T00:00:00.000Z" } };
  };

  const effective = await withTestFlightEnv(
    false,
    () => repo.getUserEntitlement("ChapterFlow-staging", QA_USER),
    "staging",
  );

  assert.deepEqual(sortKeys, ["ENTITLEMENT"]);
  assert.equal(effective?.plan, "PRO");
});

test("direct verification can consistently confirm its isolated Sandbox row", async () => {
  const sortKeys: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (aws.ddbDoc as any).send = async (command: { input: { Key: { SK: string } } }) => {
    sortKeys.push(command.input.Key.SK);
    return { Item: sandboxItem() };
  };

  const entitlement = await withTestFlightEnv(false, () =>
    repo.getUserEntitlement("ChapterFlow-test", QA_USER, {
      consistentRead: true,
      appleStorageLane: "TestFlightSandbox",
    }),
  );

  assert.deepEqual(sortKeys, ["ENTITLEMENT#APPLE_SANDBOX"]);
  assert.equal(entitlement?.plan, "PRO");
});
