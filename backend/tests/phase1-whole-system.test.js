const test = require("node:test");
const assert = require("node:assert/strict");
const { buildApp } = require("../src/app");
const { WalletService } = require("../src/services/wallet-service");
const { NotificationService } = require("../src/services/notification-service");
const { ClaimsEngine } = require("../src/services/claims-engine");
const { ClaimsReadService } = require("../src/services/claims-read-service");
const { PolicyService } = require("../src/services/policy-service");
const { DashboardService } = require("../src/services/dashboard-service");
const { AdminService } = require("../src/services/admin-service");
const { QuoteService } = require("../src/services/quote-service");
const { createTestDataStore } = require("./test-helpers");
const { createAuthToken, seedQuote } = require("./feature-helpers");
const { invokeApp } = require("./http-test-utils");

function createSystem({
  nowIso,
  mlQuote = {
    risk_score: 0.52,
    risk_band: "medium",
    premium: 58,
    payout_cap: 4800,
    lunch_shift_max_payout: 336,
    dinner_shift_max_payout: 544,
    explanation: {
      top_factors: [{ factor: "AQI forecast", contribution_pct: 100, detail: "Elevated AQI expected" }],
      summary: "Medium risk this week."
    }
  },
  weatherSummary = {
    source: "test",
    avg_max_temp: 28,
    avg_max_rain: 0,
    avg_max_aqi: 180,
    daily: {
      apparent_temperature_max: [28],
      precipitation_sum: [0],
      daily_max_aqi: [180]
    }
  },
  notificationServiceOverride = null
} = {}) {
  const { dataStore } = createTestDataStore();
  const nowProvider = () => new Date(nowIso);
  const walletService = new WalletService({ dataStore });
  const notificationService = notificationServiceOverride || new NotificationService({ dataStore });
  const weatherService = {
    async fetchWeeklyForecastSummary() {
      return weatherSummary;
    }
  };
  const quoteService = new QuoteService({
    dataStore,
    mlClient: {
      async predictPremium() {
        return mlQuote;
      }
    },
    weatherService,
    nowProvider
  });
  const claimsEngine = new ClaimsEngine({
    dataStore,
    walletService,
    notificationService,
    nowProvider
  });
  const claimsReadService = new ClaimsReadService({ dataStore });
  const policyService = new PolicyService({
    dataStore,
    walletService,
    notificationService,
    nowProvider
  });
  const dashboardService = new DashboardService({
    dataStore,
    weatherService,
    nowProvider
  });
  const adminService = new AdminService({ dataStore, claimsEngine });
  const app = buildApp({
    dataStore,
    walletService,
    notificationService,
    weatherService,
    quoteService,
    claimsEngine,
    claimsReadService,
    policyService,
    dashboardService,
    adminService
  });

  return { app, dataStore };
}

test("Phase 1: quote -> policy create -> dashboard -> wallet -> notifications works end to end", async () => {
  const { app } = createSystem({
    nowIso: "2026-04-04T12:00:00Z",
    mlQuote: {
      risk_score: 0.48,
      risk_band: "medium",
      premium: 40,
      payout_cap: 3660,
      lunch_shift_max_payout: 0,
      dinner_shift_max_payout: 488,
      explanation: {
        top_factors: [{ factor: "Rain probability", contribution_pct: 100, detail: "One wet evening expected" }],
        summary: "Moderate dinner risk."
      }
    }
  });
  const token = createAuthToken("22222222-2222-4222-8222-222222222222", "9123456780");

  const quoteResponse = await invokeApp(app, {
    method: "POST",
    url: "/api/quotes/generate",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: {
      week_start: "2026-04-06"
    }
  });

  assert.equal(quoteResponse.status, 200);
  assert.equal(quoteResponse.body.quote.can_purchase, true);
  assert.equal(quoteResponse.body.quote.week_start, "2026-04-06");

  const createResponse = await invokeApp(app, {
    method: "POST",
    url: "/api/policies/create",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: {
      quote_id: quoteResponse.body.quote.id,
      payment_method: "wallet"
    }
  });

  const dashboardResponse = await invokeApp(app, {
    method: "GET",
    url: "/api/dashboard",
    headers: {
      authorization: `Bearer ${token}`
    }
  });

  const walletResponse = await invokeApp(app, {
    method: "GET",
    url: "/api/wallet",
    headers: {
      authorization: `Bearer ${token}`
    }
  });

  const notificationsResponse = await invokeApp(app, {
    method: "GET",
    url: "/api/notifications",
    headers: {
      authorization: `Bearer ${token}`
    }
  });

  assert.equal(createResponse.status, 201);
  assert.equal(createResponse.body.policy.status, "scheduled");
  assert.equal(createResponse.body.wallet.balance, 10);
  assert.equal(createResponse.body.transaction.type, "debit_premium");

  assert.equal(dashboardResponse.status, 200);
  assert.equal(dashboardResponse.body.current_policy.id, createResponse.body.policy.id);
  assert.equal(dashboardResponse.body.current_policy.status, "scheduled");
  assert.equal(dashboardResponse.body.wallet.balance, 10);
  assert.equal(dashboardResponse.body.next_week_quote_available, false);

  assert.equal(walletResponse.status, 200);
  assert.equal(walletResponse.body.wallet.balance, 10);
  assert.equal(walletResponse.body.transactions.length, 1);
  assert.equal(walletResponse.body.transactions[0].type, "debit_premium");

  assert.equal(notificationsResponse.status, 200);
  assert.equal(notificationsResponse.body.notifications.length, 1);
  assert.equal(notificationsResponse.body.notifications[0].type, "policy_created");
});

test("Phase 1: existing policy -> renew keeps current policy stable and updates history/dashboard/notifications", async () => {
  const { app } = createSystem({
    nowIso: "2026-04-04T12:00:00Z",
    mlQuote: {
      risk_score: 0.56,
      risk_band: "medium",
      premium: 60,
      payout_cap: 5280,
      lunch_shift_max_payout: 336,
      dinner_shift_max_payout: 544,
      explanation: {
        top_factors: [{ factor: "AQI forecast", contribution_pct: 100, detail: "Two polluted evenings expected" }],
        summary: "Renewal quote generated."
      }
    }
  });
  const token = createAuthToken("11111111-1111-4111-8111-111111111111", "9876543210");

  const quoteResponse = await invokeApp(app, {
    method: "POST",
    url: "/api/quotes/generate",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: {
      week_start: "2026-04-06"
    }
  });

  const renewResponse = await invokeApp(app, {
    method: "POST",
    url: "/api/policies/policy-asha-active/renew",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: {
      quote_id: quoteResponse.body.quote.id,
      payment_method: "direct"
    }
  });

  const currentResponse = await invokeApp(app, {
    method: "GET",
    url: "/api/policies/current",
    headers: {
      authorization: `Bearer ${token}`
    }
  });

  const historyResponse = await invokeApp(app, {
    method: "GET",
    url: "/api/policies/history?limit=20&offset=0",
    headers: {
      authorization: `Bearer ${token}`
    }
  });

  const dashboardResponse = await invokeApp(app, {
    method: "GET",
    url: "/api/dashboard",
    headers: {
      authorization: `Bearer ${token}`
    }
  });

  const notificationsResponse = await invokeApp(app, {
    method: "GET",
    url: "/api/notifications",
    headers: {
      authorization: `Bearer ${token}`
    }
  });

  assert.equal(renewResponse.status, 201);
  assert.equal(renewResponse.body.policy.status, "scheduled");
  assert.deepEqual(renewResponse.body.payment, {
    method: "direct",
    status: "recorded"
  });

  assert.equal(currentResponse.status, 200);
  assert.equal(currentResponse.body.current_policy.id, "policy-asha-active");
  assert.equal(currentResponse.body.current_policy.status, "active");

  assert.equal(historyResponse.status, 200);
  assert.equal(historyResponse.body.policies.length, 2);
  assert.equal(historyResponse.body.policies[0].week_start, "2026-04-06");

  assert.equal(dashboardResponse.status, 200);
  assert.equal(dashboardResponse.body.current_policy.id, "policy-asha-active");
  assert.equal(dashboardResponse.body.next_week_quote_available, false);

  assert.equal(notificationsResponse.status, 200);
  assert.equal(notificationsResponse.body.notifications[0].type, "policy_renewed");
});

test("Phase 1: policy -> trigger -> claim -> wallet -> dashboard -> notifications stays consistent", async () => {
  const { app } = createSystem({
    nowIso: "2026-04-01T12:00:00Z"
  });
  const token = createAuthToken("11111111-1111-4111-8111-111111111111", "9876543210");

  const triggerResponse = await invokeApp(app, {
    method: "POST",
    url: "/api/admin/simulate-trigger",
    headers: {
      "content-type": "application/json"
    },
    body: {
      zone_id: "koramangala",
      trigger_type: "aqi",
      shift_type: "dinner",
      payout_percent: 45,
      value: 342
    }
  });

  const claimsResponse = await invokeApp(app, {
    method: "GET",
    url: "/api/claims",
    headers: {
      authorization: `Bearer ${token}`
    }
  });

  const walletResponse = await invokeApp(app, {
    method: "GET",
    url: "/api/wallet",
    headers: {
      authorization: `Bearer ${token}`
    }
  });

  const dashboardResponse = await invokeApp(app, {
    method: "GET",
    url: "/api/dashboard",
    headers: {
      authorization: `Bearer ${token}`
    }
  });

  const notificationsResponse = await invokeApp(app, {
    method: "GET",
    url: "/api/notifications",
    headers: {
      authorization: `Bearer ${token}`
    }
  });

  assert.equal(triggerResponse.status, 201);
  assert.equal(triggerResponse.body.claims_paid_count, 1);
  assert.equal(triggerResponse.body.claims_under_review_count, 0);
  assert.equal(triggerResponse.body.total_wallet_credited, 306);

  assert.equal(claimsResponse.status, 200);
  assert.equal(claimsResponse.body.claims.length, 1);
  assert.equal(claimsResponse.body.claims[0].status, "paid");
  assert.equal(claimsResponse.body.claims[0].payout_amount, 306);

  assert.equal(walletResponse.status, 200);
  assert.equal(walletResponse.body.wallet.balance, 662);
  assert.equal(walletResponse.body.transactions[0].type, "credit_payout");
  assert.equal(walletResponse.body.transactions[0].amount, 306);

  assert.equal(dashboardResponse.status, 200);
  assert.equal(dashboardResponse.body.current_policy.id, "policy-asha-active");
  assert.equal(dashboardResponse.body.current_policy.claims_this_week, 1);
  assert.equal(dashboardResponse.body.current_policy.total_payout_this_week, 306);

  assert.equal(notificationsResponse.status, 200);
  assert.equal(notificationsResponse.body.notifications[0].type, "claim_paid");
});

test("Phase 1: under-review claim path creates claim without payout and keeps dashboard/wallet consistent", async () => {
  const { app, dataStore } = createSystem({
    nowIso: "2026-04-01T12:00:00Z"
  });
  const token = createAuthToken("11111111-1111-4111-8111-111111111111", "9876543210");
  const store = dataStore.readStore();
  const rider = store.riders.find((entry) => entry.id === "11111111-1111-4111-8111-111111111111");
  rider.last_app_active = "2026-03-29T10:00:00Z";
  const platformRider = store.mock_platform_riders.find((entry) => entry.phone === "9876543210");
  platformRider.last_active = "2026-03-28T10:00:00Z";
  dataStore.writeStore(store);

  const triggerResponse = await invokeApp(app, {
    method: "POST",
    url: "/api/admin/simulate-trigger",
    headers: {
      "content-type": "application/json"
    },
    body: {
      zone_id: "koramangala",
      trigger_type: "rain",
      shift_type: "dinner",
      payout_percent: 45,
      value: 22
    }
  });

  const claimsResponse = await invokeApp(app, {
    method: "GET",
    url: "/api/claims",
    headers: {
      authorization: `Bearer ${token}`
    }
  });

  const dashboardResponse = await invokeApp(app, {
    method: "GET",
    url: "/api/dashboard",
    headers: {
      authorization: `Bearer ${token}`
    }
  });

  const walletResponse = await invokeApp(app, {
    method: "GET",
    url: "/api/wallet",
    headers: {
      authorization: `Bearer ${token}`
    }
  });

  const notificationsResponse = await invokeApp(app, {
    method: "GET",
    url: "/api/notifications",
    headers: {
      authorization: `Bearer ${token}`
    }
  });

  assert.equal(triggerResponse.status, 201);
  assert.equal(triggerResponse.body.claims_paid_count, 0);
  assert.equal(triggerResponse.body.claims_under_review_count, 1);
  assert.equal(triggerResponse.body.total_wallet_credited, 0);

  assert.equal(claimsResponse.status, 200);
  assert.equal(claimsResponse.body.claims.length, 1);
  assert.equal(claimsResponse.body.claims[0].status, "under_review");

  assert.equal(dashboardResponse.status, 200);
  assert.equal(dashboardResponse.body.current_policy.claims_this_week, 1);
  assert.equal(dashboardResponse.body.current_policy.total_payout_this_week, 0);

  assert.equal(walletResponse.status, 200);
  assert.equal(walletResponse.body.wallet.balance, 356);

  assert.equal(notificationsResponse.status, 200);
  assert.equal(notificationsResponse.body.notifications[0].type, "claim_under_review");
});

test("Phase 1: blocked purchase path creates no policy, wallet mutation, or notification side effect", async () => {
  const { app, dataStore } = createSystem({
    nowIso: "2026-04-04T12:00:00Z"
  });
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
  const walletBefore = await dataStore.getWalletByRiderId("11111111-1111-4111-8111-111111111111");
  const txBefore = await dataStore.listWalletTransactionsByRiderId("11111111-1111-4111-8111-111111111111");

  await dataStore.createTriggerEvent({
    zone_id: "koramangala",
    trigger_type: "aqi",
    severity_level: 2,
    payout_percent: 45,
    shift_type: "lunch",
    condition_a_data: {
      aqi_value: 320,
      threshold: 301,
      duration_minutes: 90
    },
    condition_b_data: {},
    detected_at: "2026-04-04T11:30:00Z"
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
      payment_method: "wallet"
    }
  });

  const walletAfter = await dataStore.getWalletByRiderId("11111111-1111-4111-8111-111111111111");
  const txAfter = await dataStore.listWalletTransactionsByRiderId("11111111-1111-4111-8111-111111111111");
  const notifications = await dataStore.listNotificationsByRiderId("11111111-1111-4111-8111-111111111111");
  const blockedPolicy = await dataStore.getPolicyByRiderAndWeekStart(
    "11111111-1111-4111-8111-111111111111",
    "2026-04-06"
  );

  assert.equal(createResponse.status, 409);
  assert.equal(createResponse.body.error, "disruption_active");
  assert.equal(walletAfter.balance, walletBefore.balance);
  assert.equal(txAfter.length, txBefore.length);
  assert.equal(notifications.length, 0);
  assert.equal(blockedPolicy, null);
});

test("Phase 1: rider isolation holds across policies, claims, wallet, dashboard, and notifications", async () => {
  const { app } = createSystem({
    nowIso: "2026-04-01T12:00:00Z"
  });
  const ashaToken = createAuthToken("11111111-1111-4111-8111-111111111111", "9876543210");
  const rohanToken = createAuthToken("22222222-2222-4222-8222-222222222222", "9123456780");

  const triggerResponse = await invokeApp(app, {
    method: "POST",
    url: "/api/admin/simulate-trigger",
    headers: {
      "content-type": "application/json"
    },
    body: {
      zone_id: "koramangala",
      trigger_type: "aqi",
      shift_type: "dinner",
      payout_percent: 45,
      value: 345
    }
  });

  assert.equal(triggerResponse.status, 201);
  const ashaClaims = await invokeApp(app, {
    method: "GET",
    url: "/api/claims",
    headers: {
      authorization: `Bearer ${ashaToken}`
    }
  });
  const createdClaimId = ashaClaims.body.claims[0].id;

  const policyDetailResponse = await invokeApp(app, {
    method: "GET",
    url: "/api/policies/policy-asha-active",
    headers: {
      authorization: `Bearer ${rohanToken}`
    }
  });

  const claimDetailResponse = await invokeApp(app, {
    method: "GET",
    url: `/api/claims/${createdClaimId}`,
    headers: {
      authorization: `Bearer ${rohanToken}`
    }
  });

  const walletResponse = await invokeApp(app, {
    method: "GET",
    url: "/api/wallet",
    headers: {
      authorization: `Bearer ${rohanToken}`
    }
  });

  const dashboardResponse = await invokeApp(app, {
    method: "GET",
    url: "/api/dashboard",
    headers: {
      authorization: `Bearer ${rohanToken}`
    }
  });

  const notificationsResponse = await invokeApp(app, {
    method: "GET",
    url: "/api/notifications",
    headers: {
      authorization: `Bearer ${rohanToken}`
    }
  });

  assert.equal(policyDetailResponse.status, 404);
  assert.equal(claimDetailResponse.status, 404);
  assert.equal(walletResponse.status, 200);
  assert.equal(walletResponse.body.wallet.balance, 50);
  assert.equal(walletResponse.body.transactions.length, 0);
  assert.equal(dashboardResponse.status, 200);
  assert.equal(dashboardResponse.body.rider.name, "Rohan Rider");
  assert.deepEqual(dashboardResponse.body.recent_claims, []);
  assert.equal(notificationsResponse.status, 200);
  assert.deepEqual(notificationsResponse.body.notifications, []);
});
