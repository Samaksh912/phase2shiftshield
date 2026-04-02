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
const { createTestDataStore } = require("./test-helpers");
const { createAuthToken } = require("./feature-helpers");
const { invokeApp } = require("./http-test-utils");

function createPhase2App({ nowIso = "2026-04-04T12:00:00Z" } = {}) {
  const { dataStore } = createTestDataStore();
  const nowProvider = () => new Date(nowIso);
  const walletService = new WalletService({ dataStore });
  const notificationService = new NotificationService({ dataStore });
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
    weatherService: {
      async fetchWeeklyForecastSummary() {
        return {
          source: "test",
          avg_max_temp: 26,
          avg_max_rain: 0,
          avg_max_aqi: 110,
          daily: {
            apparent_temperature_max: [26],
            precipitation_sum: [0],
            daily_max_aqi: [110]
          }
        };
      }
    },
    nowProvider
  });
  const adminService = new AdminService({ dataStore, claimsEngine });
  const app = buildApp({
    dataStore,
    walletService,
    notificationService,
    claimsEngine,
    claimsReadService,
    policyService,
    dashboardService,
    adminService
  });

  return { app, dataStore };
}

test("Phase 2: zero-state dashboard and notifications remain stable and do not leak internal fields", async () => {
  const { app } = createPhase2App();
  const token = createAuthToken("22222222-2222-4222-8222-222222222222", "9123456780");

  const dashboardResponse = await invokeApp(app, {
    method: "GET",
    url: "/api/dashboard",
    headers: {
      authorization: `Bearer ${token}`
    }
  });

  const notificationsResponse = await invokeApp(app, {
    method: "GET",
    url: "/api/notifications?limit=20&offset=0",
    headers: {
      authorization: `Bearer ${token}`
    }
  });

  assert.equal(dashboardResponse.status, 200);
  assert.equal(dashboardResponse.body.current_policy, null);
  assert.deepEqual(dashboardResponse.body.recent_claims, []);
  assert.deepEqual(Object.keys(dashboardResponse.body.wallet).sort(), ["balance"]);

  assert.equal(notificationsResponse.status, 200);
  assert.deepEqual(notificationsResponse.body.notifications, []);
  assert.deepEqual(notificationsResponse.body.pagination, {
    limit: 20,
    offset: 0,
    total: 0,
    has_more: false
  });
  assert.equal(notificationsResponse.body.unread_count, 0);
});

test("Phase 2: invalid renew, pagination, and simulate-trigger validation return stable errors with no side effects", async () => {
  const { app, dataStore } = createPhase2App();
  const token = createAuthToken("11111111-1111-4111-8111-111111111111", "9876543210");
  const triggerCountBefore = dataStore.readStore().trigger_events.length;

  const renewResponse = await invokeApp(app, {
    method: "POST",
    url: "/api/policies/missing-policy/renew",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: {
      quote_id: "missing-quote",
      payment_method: "wallet"
    }
  });

  const historyResponse = await invokeApp(app, {
    method: "GET",
    url: "/api/policies/history?limit=0&offset=0",
    headers: {
      authorization: `Bearer ${token}`
    }
  });

  const notificationsResponse = await invokeApp(app, {
    method: "GET",
    url: "/api/notifications?limit=101&offset=0",
    headers: {
      authorization: `Bearer ${token}`
    }
  });

  const triggerResponse = await invokeApp(app, {
    method: "POST",
    url: "/api/admin/simulate-trigger",
    headers: {
      "content-type": "application/json"
    },
    body: {
      zone_id: "koramangala",
      trigger_type: "AQI",
      shift_type: "dinner"
    }
  });

  assert.equal(renewResponse.status, 404);
  assert.deepEqual(renewResponse.body, {
    error: "not_found",
    message: "Policy not found"
  });

  assert.equal(historyResponse.status, 400);
  assert.equal(historyResponse.body.error, "validation_error");
  assert.match(historyResponse.body.message, /limit must be a safe positive integer/i);

  assert.equal(notificationsResponse.status, 400);
  assert.equal(notificationsResponse.body.error, "validation_error");
  assert.match(notificationsResponse.body.message, /limit must be a safe positive integer/i);

  assert.equal(triggerResponse.status, 400);
  assert.deepEqual(triggerResponse.body, {
    error: "validation_error",
    message: "trigger_type must be one of rain, heat, aqi"
  });
  assert.equal(dataStore.readStore().trigger_events.length, triggerCountBefore);
});
