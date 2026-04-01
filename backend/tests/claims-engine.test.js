const test = require("node:test");
const assert = require("node:assert/strict");
const { ClaimsEngine } = require("../src/services/claims-engine");
const { WalletService } = require("../src/services/wallet-service");
const { createTestDataStore } = require("./test-helpers");

async function createBaseTriggerEvent(dataStore, overrides = {}) {
  return dataStore.createTriggerEvent({
    zone_id: "koramangala",
    trigger_type: "aqi",
    severity_level: 2,
    payout_percent: 45,
    shift_type: "dinner",
    condition_a_data: { aqi_value: 342, threshold: 301, duration_minutes: 135 },
    condition_b_data: {
      traffic_drop: { confirmed: true, drop_pct: 47 },
      restaurant_drop: { confirmed: true, drop_pct: 38 },
      rider_count_drop: { confirmed: false, drop_pct: 22 }
    },
    ...overrides
  });
}

test("ClaimsEngine creates claim and credits wallet for paid trigger", async () => {
  const { dataStore } = createTestDataStore();
  const walletService = new WalletService({ dataStore });
  const claimsEngine = new ClaimsEngine({
    dataStore,
    walletService,
    nowProvider: () => new Date("2026-03-31T14:45:00Z")
  });

  const triggerEvent = await createBaseTriggerEvent(dataStore);

  const result = await claimsEngine.processClaimsForTrigger(triggerEvent);
  assert.equal(result.affected_policies_count, 1);
  assert.equal(result.claims_paid_count, 1);
  assert.equal(result.claims_under_review_count, 0);
  assert.equal(result.total_wallet_credited, 306);

  const wallet = await dataStore.getWalletByRiderId("11111111-1111-4111-8111-111111111111");
  assert.equal(wallet.balance, 662);

  const claims = await dataStore.listClaimsByRiderId("11111111-1111-4111-8111-111111111111");
  assert.equal(claims.length, 1);
  assert.equal(claims[0].status, "paid");
  assert.equal(claims[0].payout_amount, 306);
});

test("ClaimsEngine enforces idempotency and credits wallet only once for the same claim date and shift", async () => {
  const { dataStore } = createTestDataStore();
  const walletService = new WalletService({ dataStore });
  const claimsEngine = new ClaimsEngine({
    dataStore,
    walletService,
    nowProvider: () => new Date("2026-03-31T14:45:00Z")
  });

  const firstTriggerEvent = await createBaseTriggerEvent(dataStore);
  const firstResult = await claimsEngine.processClaimsForTrigger(firstTriggerEvent);
  assert.equal(firstResult.claims_paid_count, 1);
  assert.equal(firstResult.total_wallet_credited, 306);

  const walletAfterFirstRun = await dataStore.getWalletByRiderId("11111111-1111-4111-8111-111111111111");
  assert.equal(walletAfterFirstRun.balance, 662);

  const secondTriggerEvent = await createBaseTriggerEvent(dataStore, {
    id: "trigger-duplicate-same-day",
    detected_at: "2026-03-31T16:00:00Z"
  });
  const secondResult = await claimsEngine.processClaimsForTrigger(secondTriggerEvent);

  assert.equal(secondResult.affected_policies_count, 1);
  assert.equal(secondResult.claims_paid_count, 0);
  assert.equal(secondResult.claims_under_review_count, 0);
  assert.equal(secondResult.total_wallet_credited, 0);
  assert.equal(secondResult.results.length, 1);
  assert.equal(secondResult.results[0].outcome, "skipped");
  assert.equal(secondResult.results[0].reason, "hard_fail");
  assert.equal(secondResult.results[0].checks.duplicate_check, false);

  const claims = await dataStore.listClaimsByRiderId("11111111-1111-4111-8111-111111111111");
  assert.equal(claims.length, 1);

  const walletAfterSecondRun = await dataStore.getWalletByRiderId("11111111-1111-4111-8111-111111111111");
  assert.equal(walletAfterSecondRun.balance, 662);
});

test("ClaimsEngine creates under_review claim without wallet credit when soft fraud checks fail", async () => {
  const { dataStore } = createTestDataStore();
  const walletService = new WalletService({ dataStore });
  const claimsEngine = new ClaimsEngine({
    dataStore,
    walletService,
    nowProvider: () => new Date("2026-03-31T14:45:00Z")
  });

  const store = dataStore.readStore();
  store.riders[0].last_app_active = "2026-03-29T10:00:00Z";
  store.mock_platform_riders[0].last_active = "2026-03-28T10:00:00Z";
  dataStore.writeStore(store);

  const openingWallet = await dataStore.getWalletByRiderId("11111111-1111-4111-8111-111111111111");
  const triggerEvent = await createBaseTriggerEvent(dataStore);
  const result = await claimsEngine.processClaimsForTrigger(triggerEvent);

  assert.equal(result.affected_policies_count, 1);
  assert.equal(result.claims_paid_count, 0);
  assert.equal(result.claims_under_review_count, 1);
  assert.equal(result.total_wallet_credited, 0);
  assert.equal(result.results[0].outcome, "under_review");
  assert.equal(result.results[0].checks.recent_activity, false);
  assert.equal(result.results[0].checks.platform_active, false);

  const claims = await dataStore.listClaimsByRiderId("11111111-1111-4111-8111-111111111111");
  assert.equal(claims.length, 1);
  assert.equal(claims[0].status, "under_review");
  assert.equal(claims[0].fraud_flag, true);

  const closingWallet = await dataStore.getWalletByRiderId("11111111-1111-4111-8111-111111111111");
  assert.equal(closingWallet.balance, openingWallet.balance);

  const transactions = await dataStore.listWalletTransactionsByWalletId(openingWallet.id);
  assert.equal(transactions.some((transaction) => transaction.reference_id === claims[0].id), false);
});

test("ClaimsEngine skips claim and wallet credit on hard-fail duplicate check", async () => {
  const { dataStore } = createTestDataStore();
  const walletService = new WalletService({ dataStore });
  const claimsEngine = new ClaimsEngine({
    dataStore,
    walletService,
    nowProvider: () => new Date("2026-03-31T14:45:00Z")
  });

  await dataStore.createClaim({
    id: "claim-existing-duplicate",
    rider_id: "11111111-1111-4111-8111-111111111111",
    policy_id: "policy-asha-active",
    trigger_event_id: "trigger-seeded-existing",
    shift_type: "dinner",
    claim_date: "2026-03-31",
    baseline_used: 680,
    payout_percent: 45,
    payout_amount: 306,
    status: "paid",
    fraud_flag: false,
    created_at: "2026-03-31T12:00:00Z"
  });

  const openingWallet = await dataStore.getWalletByRiderId("11111111-1111-4111-8111-111111111111");
  const triggerEvent = await createBaseTriggerEvent(dataStore);
  const result = await claimsEngine.processClaimsForTrigger(triggerEvent);

  assert.equal(result.affected_policies_count, 1);
  assert.equal(result.claims_paid_count, 0);
  assert.equal(result.claims_under_review_count, 0);
  assert.equal(result.total_wallet_credited, 0);
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].outcome, "skipped");
  assert.equal(result.results[0].reason, "hard_fail");
  assert.equal(result.results[0].checks.duplicate_check, false);

  const claims = await dataStore.listClaimsByRiderId("11111111-1111-4111-8111-111111111111");
  assert.equal(claims.length, 1);
  assert.equal(claims[0].id, "claim-existing-duplicate");

  const closingWallet = await dataStore.getWalletByRiderId("11111111-1111-4111-8111-111111111111");
  assert.equal(closingWallet.balance, openingWallet.balance);
});
