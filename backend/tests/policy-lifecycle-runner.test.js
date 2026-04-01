const test = require("node:test");
const assert = require("node:assert/strict");
const { createTestDataStore } = require("./test-helpers");
const { WalletService } = require("../src/services/wallet-service");
const { PolicyService } = require("../src/services/policy-service");
const { createPolicyLifecycleRunner } = require("../src/policy-lifecycle");

test("standalone policy lifecycle runner invokes existing lifecycle logic and updates policy states", async () => {
  const { dataStore } = createTestDataStore();
  const walletService = new WalletService({ dataStore });
  const policyService = new PolicyService({
    dataStore,
    walletService,
    nowProvider: () => new Date("2026-04-06T00:10:00Z")
  });
  const logEntries = [];
  const runPolicyLifecycleJob = createPolicyLifecycleRunner({
    policyService,
    logger: {
      info(event, payload) {
        logEntries.push({ event, payload });
      }
    }
  });

  await dataStore.createPolicy({
    id: "policy-runner-scheduled",
    rider_id: "22222222-2222-4222-8222-222222222222",
    quote_id: null,
    week_start: "2026-04-06",
    week_end: "2026-04-12",
    shifts_covered: "dinner",
    premium_paid: 42,
    payout_cap: 3660,
    status: "scheduled",
    created_at: "2026-04-04T10:00:00Z"
  });

  const result = await runPolicyLifecycleJob();

  assert.deepEqual(result, {
    lifecycle_date: "2026-04-06",
    activated_count: 1,
    expired_count: 1
  });
  assert.deepEqual(logEntries, [
    {
      event: "policy_lifecycle_completed",
      payload: result
    }
  ]);

  const activatedPolicy = await dataStore.getPolicyByIdForRider(
    "policy-runner-scheduled",
    "22222222-2222-4222-8222-222222222222"
  );
  const expiredPolicy = await dataStore.getPolicyByIdForRider(
    "policy-asha-active",
    "11111111-1111-4111-8111-111111111111"
  );

  assert.equal(activatedPolicy.status, "active");
  assert.equal(expiredPolicy.status, "expired");
});
