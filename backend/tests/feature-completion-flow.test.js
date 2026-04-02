const test = require("node:test");
const assert = require("node:assert/strict");
const { buildApp } = require("../src/app");
const { WalletService } = require("../src/services/wallet-service");
const { NotificationService } = require("../src/services/notification-service");
const { ClaimsEngine } = require("../src/services/claims-engine");
const { PolicyService } = require("../src/services/policy-service");
const { DashboardService } = require("../src/services/dashboard-service");
const { AdminService } = require("../src/services/admin-service");
const { createTestDataStore } = require("./test-helpers");
const { createAuthToken, seedQuote } = require("./feature-helpers");
const { invokeApp } = require("./http-test-utils");

test("renew, dashboard, and notifications coexist with the current policy/claims/wallet slices", async () => {
  const { dataStore } = createTestDataStore();
  const nowProvider = () => new Date("2026-04-01T12:00:00Z");
  const weatherService = {
    async fetchWeeklyForecastSummary() {
      return {
        source: "test",
        avg_max_temp: 28,
        avg_max_rain: 0,
        avg_max_aqi: 180,
        daily: {
          apparent_temperature_max: [28],
          precipitation_sum: [0],
          daily_max_aqi: [180]
        }
      };
    }
  };
  const walletService = new WalletService({ dataStore });
  const notificationService = new NotificationService({ dataStore });
  const claimsEngine = new ClaimsEngine({
    dataStore,
    walletService,
    notificationService,
    nowProvider
  });
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
    claimsEngine,
    policyService,
    dashboardService,
    adminService,
    weatherService
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

  const renewResponse = await invokeApp(app, {
    method: "POST",
    url: "/api/policies/policy-asha-active/renew",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: {
      quote_id: quote.id,
      payment_method: "wallet"
    }
  });

  const simulateResponse = await invokeApp(app, {
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
  assert.equal(renewResponse.body.policy.week_start, "2026-04-06");
  assert.equal(simulateResponse.status, 201);
  assert.equal(simulateResponse.body.claims_paid_count, 1);

  assert.equal(dashboardResponse.status, 200);
  assert.equal(dashboardResponse.body.wallet.balance, 602);
  assert.equal(dashboardResponse.body.current_policy.id, "policy-asha-active");
  assert.equal(dashboardResponse.body.current_policy.claims_this_week, 1);
  assert.equal(dashboardResponse.body.current_policy.total_payout_this_week, 306);
  assert.equal(dashboardResponse.body.next_week_quote_available, false);

  assert.equal(notificationsResponse.status, 200);
  const notificationTypes = notificationsResponse.body.notifications.map((notification) => notification.type);
  assert.equal(notificationTypes.includes("policy_renewed"), true);
  assert.equal(notificationTypes.includes("claim_paid"), true);
});
