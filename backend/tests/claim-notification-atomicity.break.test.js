const test = require("node:test");
const assert = require("node:assert/strict");
const { buildApp } = require("../src/app");
const { WalletService } = require("../src/services/wallet-service");
const { ClaimsEngine } = require("../src/services/claims-engine");
const { ClaimsReadService } = require("../src/services/claims-read-service");
const { PolicyService } = require("../src/services/policy-service");
const { DashboardService } = require("../src/services/dashboard-service");
const { AdminService } = require("../src/services/admin-service");
const { createTestDataStore } = require("./test-helpers");
const { invokeApp } = require("./http-test-utils");

test("simulate-trigger should still succeed if notification creation fails after claim payout commits", async () => {
  const { dataStore } = createTestDataStore();
  const nowProvider = () => new Date("2026-04-01T12:00:00Z");
  const walletService = new WalletService({ dataStore });
  const notificationService = {
    async createNotification() {
      throw new Error("notification delivery failed");
    }
  };
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
  const walletBefore = await dataStore.getWalletByRiderId("11111111-1111-4111-8111-111111111111");
  const claimsBefore = await dataStore.listClaimsByRiderId("11111111-1111-4111-8111-111111111111");

  const response = await invokeApp(app, {
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
      value: 340
    }
  });

  const walletAfter = await dataStore.getWalletByRiderId("11111111-1111-4111-8111-111111111111");
  const claimsAfter = await dataStore.listClaimsByRiderId("11111111-1111-4111-8111-111111111111");

  assert.equal(response.status, 201);
  assert.equal(walletAfter.balance, walletBefore.balance + 306);
  assert.equal(claimsAfter.length, claimsBefore.length + 1);
  assert.equal(response.body.claims_paid_count, 1);
});
