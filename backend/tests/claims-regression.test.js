const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const { buildApp } = require("../src/app");
const { ClaimsEngine } = require("../src/services/claims-engine");
const { ClaimsReadService } = require("../src/services/claims-read-service");
const { getConfig } = require("../src/utils/config");
const { createTestDataStore } = require("./test-helpers");
const { invokeApp } = require("./http-test-utils");

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

test("ClaimsEngine rolls back a paid claim when wallet credit fails", async () => {
  const { dataStore } = createTestDataStore();
  const openingWallet = await dataStore.getWalletByRiderId("11111111-1111-4111-8111-111111111111");
  const claimsEngine = new ClaimsEngine({
    dataStore,
    walletService: {
      async creditWallet() {
        throw new Error("wallet credit failed");
      }
    },
    nowProvider: () => new Date("2026-03-31T14:45:00Z")
  });
  const triggerEvent = await createBaseTriggerEvent(dataStore);

  await assert.rejects(() => claimsEngine.processClaimsForTrigger(triggerEvent), /wallet credit failed/);

  const claims = await dataStore.listClaimsByRiderId("11111111-1111-4111-8111-111111111111");
  assert.equal(claims.length, 0);

  const closingWallet = await dataStore.getWalletByRiderId("11111111-1111-4111-8111-111111111111");
  assert.equal(closingWallet.balance, openingWallet.balance);
});

test("GET /api/claims/:id does not expose another rider's claim", async () => {
  const { dataStore } = createTestDataStore();
  const claimsReadService = new ClaimsReadService({ dataStore });
  const app = buildApp({ dataStore, claimsReadService });
  const triggerEvent = await createBaseTriggerEvent(dataStore, { id: "trigger-isolation-check" });

  await dataStore.createClaim({
    id: "claim-owned-by-rider-1",
    rider_id: "11111111-1111-4111-8111-111111111111",
    policy_id: "policy-asha-active",
    trigger_event_id: triggerEvent.id,
    shift_type: "dinner",
    claim_date: "2026-03-31",
    baseline_used: 680,
    payout_percent: 45,
    payout_amount: 306,
    status: "paid",
    fraud_flag: false,
    created_at: "2026-03-31T20:15:00Z"
  });

  const riderTwoToken = jwt.sign(
    {
      rider_id: "22222222-2222-4222-8222-222222222222",
      phone: "9123456780"
    },
    getConfig().jwtSecret,
    { expiresIn: "7d" }
  );

  const response = await invokeApp(app, {
    method: "GET",
    url: "/api/claims/claim-owned-by-rider-1",
    headers: {
      authorization: `Bearer ${riderTwoToken}`
    }
  });

  assert.equal(response.status, 404);
  assert.deepEqual(response.body, {
    error: "not_found",
    message: "Claim not found"
  });
});
