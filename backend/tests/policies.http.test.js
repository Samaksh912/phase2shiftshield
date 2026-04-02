const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const { buildApp } = require("../src/app");
const { WalletService } = require("../src/services/wallet-service");
const { PolicyService } = require("../src/services/policy-service");
const { getConfig } = require("../src/utils/config");
const { createTestDataStore } = require("./test-helpers");
const { invokeApp } = require("./http-test-utils");

function createAuthToken(riderId, phone) {
  return jwt.sign(
    {
      rider_id: riderId,
      phone
    },
    getConfig().jwtSecret,
    { expiresIn: "7d" }
  );
}

async function seedQuote(dataStore, {
  riderId,
  zoneId,
  weekStart,
  shiftsCovered,
  premium,
  payoutCap,
  validUntil
}) {
  return dataStore.saveQuote({
    rider_id: riderId,
    zone_id: zoneId,
    week_start: weekStart,
    shifts_covered: shiftsCovered,
    risk_score: 0.52,
    risk_band: "medium",
    premium,
    payout_cap: payoutCap,
    explanation: {
      top_factors: [],
      summary: "Seeded test quote"
    },
    valid_until: validUntil
  });
}

function setActiveDaysLast30(dataStore, phone, activeDaysLast30) {
  const store = dataStore.readStore();
  const platformRider = store.mock_platform_riders.find((rider) => rider.phone === phone);
  platformRider.active_days_last_30 = activeDaysLast30;
  dataStore.writeStore(store);
}

test("POST /api/policies/create debits wallet and creates a scheduled policy", async () => {
  const { dataStore } = createTestDataStore();
  const walletService = new WalletService({ dataStore });
  const policyService = new PolicyService({
    dataStore,
    walletService,
    nowProvider: () => new Date("2026-04-04T12:00:00Z")
  });
  const app = buildApp({ dataStore, walletService, policyService });
  const token = createAuthToken("11111111-1111-4111-8111-111111111111", "9876543210");

  const quote = await seedQuote(dataStore, {
    riderId: "11111111-1111-4111-8111-111111111111",
    zoneId: "koramangala",
    weekStart: "2026-04-06",
    shiftsCovered: "both",
    premium: 60,
    payoutCap: 5280,
    validUntil: "2026-04-05T23:59:00+05:30"
  });

  const response = await invokeApp(app, {
    method: "POST",
    url: "/api/policies/create",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: {
      quote_id: quote.id,
      payment_method: "wallet"
    }
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.policy.status, "scheduled");
  assert.equal(response.body.policy.week_start, "2026-04-06");
  assert.equal(response.body.wallet.previous_balance, 356);
  assert.equal(response.body.wallet.balance, 296);
  assert.equal(response.body.transaction.type, "debit_premium");
  assert.equal(response.body.transaction.amount, -60);
});

test("policy current, history, and detail endpoints expose rider-facing policy data", async () => {
  const { dataStore } = createTestDataStore();
  const walletService = new WalletService({ dataStore });
  const policyService = new PolicyService({
    dataStore,
    walletService,
    nowProvider: () => new Date("2026-04-04T12:00:00Z")
  });
  const app = buildApp({ dataStore, walletService, policyService });
  const token = createAuthToken("22222222-2222-4222-8222-222222222222", "9123456780");

  const quote = await seedQuote(dataStore, {
    riderId: "22222222-2222-4222-8222-222222222222",
    zoneId: "whitefield",
    weekStart: "2026-04-06",
    shiftsCovered: "dinner",
    premium: 40,
    payoutCap: 3660,
    validUntil: "2026-04-05T23:59:00+05:30"
  });

  const createResponse = await invokeApp(app, {
    method: "POST",
    url: "/api/policies/create",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: {
      quote_id: quote.id,
      payment_method: "direct"
    }
  });

  assert.equal(createResponse.status, 201);
  assert.deepEqual(createResponse.body.payment, {
    method: "direct",
    status: "recorded"
  });

  const currentResponse = await invokeApp(app, {
    method: "GET",
    url: "/api/policies/current",
    headers: {
      authorization: `Bearer ${token}`
    }
  });

  assert.equal(currentResponse.status, 200);
  assert.equal(currentResponse.body.current_policy.id, createResponse.body.policy.id);
  assert.equal(currentResponse.body.current_policy.status, "scheduled");

  const historyResponse = await invokeApp(app, {
    method: "GET",
    url: "/api/policies/history?limit=20&offset=0",
    headers: {
      authorization: `Bearer ${token}`
    }
  });

  assert.equal(historyResponse.status, 200);
  assert.equal(historyResponse.body.policies.length, 1);
  assert.equal(historyResponse.body.pagination.has_more, false);

  const detailResponse = await invokeApp(app, {
    method: "GET",
    url: `/api/policies/${createResponse.body.policy.id}`,
    headers: {
      authorization: `Bearer ${token}`
    }
  });

  assert.equal(detailResponse.status, 200);
  assert.equal(detailResponse.body.policy.id, createResponse.body.policy.id);
  assert.equal(detailResponse.body.policy.shifts_covered, "dinner");
});

test("POST /api/policies/create returns contract fields for insufficient wallet balance", async () => {
  const { dataStore } = createTestDataStore();
  const walletService = new WalletService({ dataStore });
  const policyService = new PolicyService({
    dataStore,
    walletService,
    nowProvider: () => new Date("2026-04-04T12:00:00Z")
  });
  const app = buildApp({ dataStore, walletService, policyService });
  const token = createAuthToken("22222222-2222-4222-8222-222222222222", "9123456780");

  const quote = await seedQuote(dataStore, {
    riderId: "22222222-2222-4222-8222-222222222222",
    zoneId: "whitefield",
    weekStart: "2026-04-06",
    shiftsCovered: "dinner",
    premium: 80,
    payoutCap: 3660,
    validUntil: "2026-04-05T23:59:00+05:30"
  });

  const response = await invokeApp(app, {
    method: "POST",
    url: "/api/policies/create",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: {
      quote_id: quote.id,
      payment_method: "wallet"
    }
  });

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, {
    error: "insufficient_balance",
    wallet_balance: 50,
    premium_required: 80,
    shortfall: 30,
    message: "Insufficient wallet balance. Please top up ₹30 or choose direct payment."
  });
});

test("POST /api/policies/create still rejects expired quotes for eligible riders", async () => {
  const { dataStore } = createTestDataStore();
  setActiveDaysLast30(dataStore, "9876543210", 9);
  const walletService = new WalletService({ dataStore });
  const policyService = new PolicyService({
    dataStore,
    walletService,
    nowProvider: () => new Date("2026-04-04T12:00:00Z")
  });
  const app = buildApp({ dataStore, walletService, policyService });
  const token = createAuthToken("11111111-1111-4111-8111-111111111111", "9876543210");

  const quote = await seedQuote(dataStore, {
    riderId: "11111111-1111-4111-8111-111111111111",
    zoneId: "koramangala",
    weekStart: "2026-04-06",
    shiftsCovered: "both",
    premium: 60,
    payoutCap: 5280,
    validUntil: "2026-04-03T23:59:00+05:30"
  });

  const response = await invokeApp(app, {
    method: "POST",
    url: "/api/policies/create",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: {
      quote_id: quote.id,
      payment_method: "direct"
    }
  });

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, {
    error: "quote_expired",
    message: "This quote has expired and can no longer be purchased"
  });
});

test("POST /api/policies/create rejects insufficient_history underwriting states", async () => {
  const { dataStore } = createTestDataStore();
  setActiveDaysLast30(dataStore, "9876543210", 6);
  const walletService = new WalletService({ dataStore });
  const policyService = new PolicyService({
    dataStore,
    walletService,
    nowProvider: () => new Date("2026-04-04T12:00:00Z")
  });
  const app = buildApp({ dataStore, walletService, policyService });
  const token = createAuthToken("11111111-1111-4111-8111-111111111111", "9876543210");

  const quote = await seedQuote(dataStore, {
    riderId: "11111111-1111-4111-8111-111111111111",
    zoneId: "koramangala",
    weekStart: "2026-04-06",
    shiftsCovered: "both",
    premium: 60,
    payoutCap: 5280,
    validUntil: "2026-04-05T23:59:00+05:30"
  });

  const response = await invokeApp(app, {
    method: "POST",
    url: "/api/policies/create",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: {
      quote_id: quote.id,
      payment_method: "direct"
    }
  });

  assert.equal(response.status, 409);
  assert.equal(response.body.error, "insufficient_history");
  assert.equal(
    response.body.message,
    "At least 7 active delivery days in the last 30 days are required to purchase or renew coverage."
  );
});

test("POST /api/policies/create rejects a seeded ineligible non-Bengaluru rider due to underwriting", async () => {
  const { dataStore } = createTestDataStore();
  const walletService = new WalletService({ dataStore });
  const policyService = new PolicyService({
    dataStore,
    walletService,
    nowProvider: () => new Date("2026-04-04T12:00:00Z")
  });
  const app = buildApp({ dataStore, walletService, policyService });
  const token = createAuthToken("33333333-3333-4333-8333-444444444444", "9988776655");

  const quote = await seedQuote(dataStore, {
    riderId: "33333333-3333-4333-8333-444444444444",
    zoneId: "pune_hinjewadi",
    weekStart: "2026-04-06",
    shiftsCovered: "both",
    premium: 34,
    payoutCap: 4920,
    validUntil: "2026-04-05T23:59:00+05:30"
  });

  const response = await invokeApp(app, {
    method: "POST",
    url: "/api/policies/create",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: {
      quote_id: quote.id,
      payment_method: "direct"
    }
  });

  assert.equal(response.status, 409);
  assert.equal(response.body.error, "insufficient_history");
  assert.equal(
    response.body.message,
    "At least 7 active delivery days in the last 30 days are required to purchase or renew coverage."
  );
});

test("POST /api/policies/create still rejects duplicate policies for eligible riders", async () => {
  const { dataStore } = createTestDataStore();
  setActiveDaysLast30(dataStore, "9876543210", 9);
  const walletService = new WalletService({ dataStore });
  const policyService = new PolicyService({
    dataStore,
    walletService,
    nowProvider: () => new Date("2026-04-04T12:00:00Z")
  });
  const app = buildApp({ dataStore, walletService, policyService });
  const token = createAuthToken("11111111-1111-4111-8111-111111111111", "9876543210");

  const quote = await seedQuote(dataStore, {
    riderId: "11111111-1111-4111-8111-111111111111",
    zoneId: "koramangala",
    weekStart: "2026-04-06",
    shiftsCovered: "both",
    premium: 60,
    payoutCap: 5280,
    validUntil: "2026-04-05T23:59:00+05:30"
  });

  await dataStore.createPolicy({
    rider_id: "11111111-1111-4111-8111-111111111111",
    quote_id: null,
    week_start: "2026-04-06",
    week_end: "2026-04-12",
    shifts_covered: "both",
    premium_paid: 60,
    payout_cap: 5280,
    status: "scheduled"
  });

  const response = await invokeApp(app, {
    method: "POST",
    url: "/api/policies/create",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: {
      quote_id: quote.id,
      payment_method: "direct"
    }
  });

  assert.equal(response.status, 409);
  assert.deepEqual(response.body, {
    error: "policy_exists",
    message: "A policy already exists for this rider and week"
  });
});

test("POST /api/policies/create blocks purchase when a recent disruption is active", async () => {
  const { dataStore } = createTestDataStore();
  const walletService = new WalletService({ dataStore });
  const policyService = new PolicyService({
    dataStore,
    walletService,
    nowProvider: () => new Date("2026-04-04T12:00:00Z")
  });
  const app = buildApp({ dataStore, walletService, policyService });
  const token = createAuthToken("11111111-1111-4111-8111-111111111111", "9876543210");

  const quote = await seedQuote(dataStore, {
    riderId: "11111111-1111-4111-8111-111111111111",
    zoneId: "koramangala",
    weekStart: "2026-04-06",
    shiftsCovered: "both",
    premium: 60,
    payoutCap: 5280,
    validUntil: "2026-04-05T23:59:00+05:30"
  });

  await dataStore.createTriggerEvent({
    zone_id: "koramangala",
    trigger_type: "rain",
    severity_level: 2,
    payout_percent: 45,
    shift_type: "lunch",
    condition_a_data: {
      precipitation_mm: 18,
      threshold: 15,
      duration_minutes: 45
    },
    condition_b_data: {},
    detected_at: "2026-04-04T11:00:00Z"
  });

  const response = await invokeApp(app, {
    method: "POST",
    url: "/api/policies/create",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: {
      quote_id: quote.id,
      payment_method: "wallet"
    }
  });

  assert.equal(response.status, 409);
  assert.equal(response.body.error, "disruption_active");
  assert.equal(
    response.body.message,
    "An active disruption event is detected in your zone. Policy purchase is temporarily unavailable."
  );
});

test("POST /api/admin/policies/run-lifecycle activates this week and expires prior week policies", async () => {
  const { dataStore } = createTestDataStore();
  const walletService = new WalletService({ dataStore });
  const policyService = new PolicyService({
    dataStore,
    walletService,
    nowProvider: () => new Date("2026-04-06T00:10:00Z")
  });
  const app = buildApp({ dataStore, walletService, policyService });

  await dataStore.createPolicy({
    id: "policy-rohan-scheduled",
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

  const response = await invokeApp(app, {
    method: "POST",
    url: "/api/admin/policies/run-lifecycle"
  });

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    lifecycle_date: "2026-04-06",
    activated_count: 1,
    expired_count: 1
  });

  const activatedPolicy = await dataStore.getPolicyByIdForRider(
    "policy-rohan-scheduled",
    "22222222-2222-4222-8222-222222222222"
  );
  const expiredPolicy = await dataStore.getPolicyByIdForRider(
    "policy-asha-active",
    "11111111-1111-4111-8111-111111111111"
  );

  assert.equal(activatedPolicy.status, "active");
  assert.equal(expiredPolicy.status, "expired");
});
