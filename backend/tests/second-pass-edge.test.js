const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const { buildApp } = require("../src/app");
const { ClaimsEngine } = require("../src/services/claims-engine");
const { ClaimsReadService } = require("../src/services/claims-read-service");
const { QuoteService } = require("../src/services/quote-service");
const { WalletService } = require("../src/services/wallet-service");
const { getConfig } = require("../src/utils/config");
const { getNextMonday } = require("../src/utils/time");
const { createTestDataStore } = require("./test-helpers");
const { invokeApp } = require("./http-test-utils");

function createAuthToken(riderId, phone) {
  return jwt.sign({ rider_id: riderId, phone }, getConfig().jwtSecret, { expiresIn: "7d" });
}

test("Quote purchase_deadline boundary remains correct at -1ms, exact, and +1ms", async () => {
  const { dataStore } = createTestDataStore();

  function createQuoteService(nowIso) {
    return new QuoteService({
      dataStore,
      mlClient: {
        async predictPremium() {
          return {
            risk_score: 0.5,
            risk_band: "medium",
            premium: 50,
            payout_cap: 1000,
            lunch_shift_max_payout: 100,
            dinner_shift_max_payout: 200,
            explanation: { top_factors: [], summary: "ok" }
          };
        }
      },
      weatherService: {
        async fetchWeeklyForecastSummary() {
          return { source: "test" };
        }
      },
      nowProvider: () => new Date(nowIso)
    });
  }

  const before = await createQuoteService("2026-04-05T18:28:59.999Z").generateQuote({
    riderId: "11111111-1111-4111-8111-111111111111",
    weekStart: "2026-04-06"
  });
  const exact = await createQuoteService("2026-04-05T18:29:00.000Z").generateQuote({
    riderId: "11111111-1111-4111-8111-111111111111",
    weekStart: "2026-04-06"
  });
  const after = await createQuoteService("2026-04-05T18:29:00.001Z").generateQuote({
    riderId: "11111111-1111-4111-8111-111111111111",
    weekStart: "2026-04-06"
  });

  assert.equal(before.quote.can_purchase, true);
  assert.equal(exact.quote.can_purchase, true);
  assert.equal(after.quote.can_purchase, false);
  assert.equal(after.quote.reason, "The purchase window for this policy week has closed.");
});

test("Next Monday calculation stays correct on Sunday late IST and Monday IST boundaries", async () => {
  assert.equal(getNextMonday(new Date("2026-04-05T18:00:00Z")), "2026-04-06");
  assert.equal(getNextMonday(new Date("2026-04-05T18:31:00Z")), "2026-04-13");
  assert.equal(getNextMonday(new Date("2026-04-06T17:59:00Z")), "2026-04-13");
});

test("simulate-trigger validation stays strict for invalid and missing inputs", async () => {
  const { dataStore } = createTestDataStore();
  const app = buildApp({ dataStore });

  const invalidCases = [
    { zone_id: "does-not-exist", trigger_type: "aqi", shift_type: "dinner", value: 350 },
    { zone_id: "koramangala", trigger_type: "bogus", shift_type: "dinner", value: 350 },
    { zone_id: "koramangala", trigger_type: "aqi", shift_type: "overnight", value: 350 },
    { trigger_type: "aqi", shift_type: "dinner", value: 350 }
  ];

  for (const body of invalidCases) {
    const response = await invokeApp(app, {
      method: "POST",
      url: "/api/admin/simulate-trigger",
      headers: { "content-type": "application/json" },
      body
    });

    assert.equal(response.status, 400);
    assert.equal(response.body.error, "validation_error");
  }
});

test("ClaimsEngine reports mixed outcomes correctly for one trigger across multiple riders", async () => {
  const { dataStore } = createTestDataStore();
  const store = dataStore.readStore();

  store.riders.push({
    id: "33333333-3333-4333-8333-333333333331",
    phone: "9000000001",
    name: "Soft Fail Rider",
    platform: "swiggy",
    zone_id: "koramangala",
    shifts_covered: "dinner",
    payout_preference: "wallet",
    upi_id: null,
    lunch_baseline: 400,
    dinner_baseline: 700,
    last_app_active: "2026-03-29T10:00:00Z",
    created_at: "2026-03-01T09:00:00Z"
  });
  store.mock_platform_riders.push({
    id: "platform-soft-fail",
    phone: "9000000001",
    platform: "swiggy",
    zone_id: "koramangala",
    rider_status: "active",
    avg_lunch_earnings: 400,
    avg_dinner_earnings: 700,
    active_days_per_week: 6,
    last_active: "2026-03-28T10:00:00Z",
    account_age_months: 8
  });
  store.wallets.push({
    id: "wallet-soft-fail",
    rider_id: "33333333-3333-4333-8333-333333333331",
    balance: 100,
    updated_at: "2026-03-30T10:00:00Z"
  });
  store.weekly_policies.push({
    id: "policy-soft-fail",
    rider_id: "33333333-3333-4333-8333-333333333331",
    quote_id: "quote-soft-fail",
    week_start: "2026-03-30",
    week_end: "2026-04-05",
    shifts_covered: "dinner",
    premium_paid: 60,
    payout_cap: 3000,
    status: "active",
    created_at: "2026-03-28T14:00:00Z"
  });

  store.riders.push({
    id: "33333333-3333-4333-8333-333333333332",
    phone: "9000000002",
    name: "Duplicate Rider",
    platform: "swiggy",
    zone_id: "koramangala",
    shifts_covered: "dinner",
    payout_preference: "wallet",
    upi_id: null,
    lunch_baseline: 410,
    dinner_baseline: 690,
    last_app_active: "2026-03-31T13:00:00Z",
    created_at: "2026-03-01T09:00:00Z"
  });
  store.mock_platform_riders.push({
    id: "platform-duplicate",
    phone: "9000000002",
    platform: "swiggy",
    zone_id: "koramangala",
    rider_status: "active",
    avg_lunch_earnings: 410,
    avg_dinner_earnings: 690,
    active_days_per_week: 6,
    last_active: "2026-03-31T13:00:00Z",
    account_age_months: 8
  });
  store.wallets.push({
    id: "wallet-duplicate",
    rider_id: "33333333-3333-4333-8333-333333333332",
    balance: 200,
    updated_at: "2026-03-30T10:00:00Z"
  });
  store.weekly_policies.push({
    id: "policy-duplicate",
    rider_id: "33333333-3333-4333-8333-333333333332",
    quote_id: "quote-duplicate",
    week_start: "2026-03-30",
    week_end: "2026-04-05",
    shifts_covered: "dinner",
    premium_paid: 60,
    payout_cap: 3000,
    status: "active",
    created_at: "2026-03-28T14:00:00Z"
  });
  store.claims.push({
    id: "claim-existing-duplicate",
    rider_id: "33333333-3333-4333-8333-333333333332",
    policy_id: "policy-duplicate",
    trigger_event_id: "trigger-existing-duplicate",
    shift_type: "dinner",
    claim_date: "2026-03-31",
    baseline_used: 690,
    payout_percent: 45,
    payout_amount: 311,
    status: "paid",
    fraud_flag: false,
    created_at: "2026-03-31T12:00:00Z"
  });

  dataStore.writeStore(store);

  const claimsEngine = new ClaimsEngine({
    dataStore,
    walletService: new WalletService({ dataStore }),
    nowProvider: () => new Date("2026-03-31T14:45:00Z")
  });

  const triggerEvent = await dataStore.createTriggerEvent({
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
    }
  });

  const result = await claimsEngine.processClaimsForTrigger(triggerEvent);

  assert.equal(result.affected_policies_count, 3);
  assert.equal(result.claims_paid_count, 1);
  assert.equal(result.claims_under_review_count, 1);
  assert.equal(result.total_wallet_credited, 306);
  assert.equal(result.results.length, 3);
  assert.equal(result.results.filter((entry) => entry.outcome === "paid").length, 1);
  assert.equal(result.results.filter((entry) => entry.outcome === "under_review").length, 1);
  assert.equal(result.results.filter((entry) => entry.outcome === "skipped").length, 1);
});

test("Repeated wallet mutations and repeated simulate-trigger runs keep state consistent", async () => {
  const { dataStore } = createTestDataStore();
  const walletService = new WalletService({ dataStore });
  const claimsEngine = new ClaimsEngine({
    dataStore,
    walletService,
    nowProvider: () => new Date("2026-03-31T14:45:00Z")
  });
  const claimsReadService = new ClaimsReadService({ dataStore });
  const adminService = {
    async simulateTrigger(payload) {
      const triggerEvent = await dataStore.createTriggerEvent({
        zone_id: payload.zone_id,
        trigger_type: payload.trigger_type,
        severity_level: 2,
        payout_percent: payload.payout_percent,
        shift_type: payload.shift_type,
        condition_a_data: { aqi_value: payload.value, threshold: 301, duration_minutes: 135 },
        condition_b_data: {
          traffic_drop: { confirmed: true, drop_pct: 47 },
          restaurant_drop: { confirmed: true, drop_pct: 38 },
          rider_count_drop: { confirmed: false, drop_pct: 22 }
        }
      });
      const processed = await claimsEngine.processClaimsForTrigger(triggerEvent);
      return {
        trigger_event: triggerEvent,
        affected_policies_count: processed.affected_policies_count,
        claims_paid_count: processed.claims_paid_count,
        claims_under_review_count: processed.claims_under_review_count,
        total_wallet_credited: processed.total_wallet_credited
      };
    }
  };
  const app = buildApp({ dataStore, walletService, claimsEngine, claimsReadService, adminService });
  const token = createAuthToken("11111111-1111-4111-8111-111111111111", "9876543210");

  const step1 = await invokeApp(app, {
    method: "POST",
    url: "/api/wallet/topup",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: { amount: 100 }
  });
  assert.equal(step1.body.wallet.balance, 456);

  const step2 = await invokeApp(app, {
    method: "POST",
    url: "/api/wallet/withdraw",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: { amount: 60 }
  });
  assert.equal(step2.body.wallet.balance, 396);

  const step3 = await invokeApp(app, {
    method: "POST",
    url: "/api/wallet/topup",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: { amount: 40 }
  });
  assert.equal(step3.body.wallet.balance, 436);

  const step4 = await invokeApp(app, {
    method: "POST",
    url: "/api/wallet/withdraw",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: { amount: 6 }
  });
  assert.equal(step4.body.wallet.balance, 430);

  const simulate1 = await invokeApp(app, {
    method: "POST",
    url: "/api/admin/simulate-trigger",
    headers: { "content-type": "application/json" },
    body: { zone_id: "koramangala", trigger_type: "aqi", shift_type: "dinner", payout_percent: 45, value: 342 }
  });
  assert.equal(simulate1.body.claims_paid_count, 1);
  assert.equal(simulate1.body.total_wallet_credited, 306);

  const claimsAfterFirst = await invokeApp(app, {
    method: "GET",
    url: "/api/claims",
    headers: { authorization: `Bearer ${token}` }
  });
  const walletAfterFirst = await invokeApp(app, {
    method: "GET",
    url: "/api/wallet",
    headers: { authorization: `Bearer ${token}` }
  });
  assert.equal(claimsAfterFirst.body.claims.length, 1);
  assert.equal(walletAfterFirst.body.wallet.balance, 736);

  const simulate2 = await invokeApp(app, {
    method: "POST",
    url: "/api/admin/simulate-trigger",
    headers: { "content-type": "application/json" },
    body: { zone_id: "koramangala", trigger_type: "aqi", shift_type: "dinner", payout_percent: 45, value: 342 }
  });
  assert.equal(simulate2.body.claims_paid_count, 0);
  assert.equal(simulate2.body.total_wallet_credited, 0);

  const claimsAfterSecond = await invokeApp(app, {
    method: "GET",
    url: "/api/claims",
    headers: { authorization: `Bearer ${token}` }
  });
  const walletAfterSecond = await invokeApp(app, {
    method: "GET",
    url: "/api/wallet",
    headers: { authorization: `Bearer ${token}` }
  });
  assert.equal(claimsAfterSecond.body.claims.length, 1);
  assert.equal(walletAfterSecond.body.wallet.balance, 736);
});

test("Zero-transaction wallet, zero-claims rider, unknown claim id, and valid trigger with no eligible policies behave cleanly", async () => {
  const { dataStore } = createTestDataStore();
  const store = dataStore.readStore();

  store.wallet_transactions = store.wallet_transactions.filter((txn) => txn.wallet_id !== "wallet-rohan");
  store.weekly_policies = store.weekly_policies.filter(
    (policy) => policy.rider_id !== "22222222-2222-4222-8222-222222222222"
  );
  dataStore.writeStore(store);

  const app = buildApp({ dataStore });
  const riderTwoToken = createAuthToken("22222222-2222-4222-8222-222222222222", "9123456780");

  const walletResponse = await invokeApp(app, {
    method: "GET",
    url: "/api/wallet",
    headers: { authorization: `Bearer ${riderTwoToken}` }
  });
  assert.equal(walletResponse.status, 200);
  assert.deepEqual(walletResponse.body.transactions, []);

  const claimsResponse = await invokeApp(app, {
    method: "GET",
    url: "/api/claims",
    headers: { authorization: `Bearer ${riderTwoToken}` }
  });
  assert.equal(claimsResponse.status, 200);
  assert.deepEqual(claimsResponse.body.claims, []);

  const missingClaimResponse = await invokeApp(app, {
    method: "GET",
    url: "/api/claims/does-not-exist",
    headers: { authorization: `Bearer ${riderTwoToken}` }
  });
  assert.equal(missingClaimResponse.status, 404);
  assert.equal(missingClaimResponse.body.error, "not_found");

  const simulateNoEligible = await invokeApp(app, {
    method: "POST",
    url: "/api/admin/simulate-trigger",
    headers: { "content-type": "application/json" },
    body: { zone_id: "whitefield", trigger_type: "rain", shift_type: "dinner", payout_percent: 45, value: 20 }
  });
  assert.equal(simulateNoEligible.status, 201);
  assert.equal(simulateNoEligible.body.affected_policies_count, 0);
  assert.equal(simulateNoEligible.body.claims_paid_count, 0);
  assert.equal(simulateNoEligible.body.claims_under_review_count, 0);
  assert.equal(simulateNoEligible.body.total_wallet_credited, 0);
});
