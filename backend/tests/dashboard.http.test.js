const test = require("node:test");
const assert = require("node:assert/strict");
const { buildApp } = require("../src/app");
const { DashboardService } = require("../src/services/dashboard-service");
const { createTestDataStore } = require("./test-helpers");
const { createAuthToken } = require("./feature-helpers");
const { invokeApp } = require("./http-test-utils");

test("GET /api/dashboard returns rider-scoped policy, wallet, weather, and claim summary", async () => {
  const { dataStore } = createTestDataStore();
  const dashboardService = new DashboardService({
    dataStore,
    weatherService: {
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
    },
    nowProvider: () => new Date("2026-04-01T12:00:00Z")
  });
  const app = buildApp({ dataStore, dashboardService });
  const token = createAuthToken("11111111-1111-4111-8111-111111111111", "9876543210");

  const triggerEvent = await dataStore.createTriggerEvent({
    id: "trigger-dashboard-1",
    zone_id: "koramangala",
    trigger_type: "aqi",
    severity_level: 2,
    payout_percent: 45,
    shift_type: "dinner",
    condition_a_data: {
      aqi_value: 342,
      threshold: 301,
      duration_minutes: 135
    },
    condition_b_data: {}
  });

  await dataStore.createClaim({
    id: "claim-dashboard-1",
    rider_id: "11111111-1111-4111-8111-111111111111",
    policy_id: "policy-asha-active",
    trigger_event_id: triggerEvent.id,
    shift_type: "dinner",
    claim_date: "2026-04-01",
    baseline_used: 680,
    payout_percent: 45,
    payout_amount: 306,
    status: "paid",
    fraud_flag: false
  });

  const response = await invokeApp(app, {
    method: "GET",
    url: "/api/dashboard",
    headers: {
      authorization: `Bearer ${token}`
    }
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.rider.name, "Asha Rider");
  assert.equal(response.body.wallet.balance, 356);
  assert.equal(response.body.current_policy.id, "policy-asha-active");
  assert.equal(response.body.current_policy.status, "active");
  assert.deepEqual(response.body.current_policy.shifts_remaining, {
    lunch: 6,
    dinner: 5
  });
  assert.equal(response.body.current_policy.claims_this_week, 1);
  assert.equal(response.body.current_policy.total_payout_this_week, 306);
  assert.equal(response.body.zone_weather.status, "normal");
  assert.equal(response.body.recent_claims.length, 1);
  assert.equal(response.body.recent_claims[0].trigger_type, "aqi");
  assert.equal(response.body.next_week_quote_available, true);
});

test("GET /api/dashboard uses geography-specific thresholds for weather status", async () => {
  const { dataStore } = createTestDataStore();
  const dashboardService = new DashboardService({
    dataStore,
    weatherService: {
      async fetchWeeklyForecastSummary() {
        return {
          source: "test",
          avg_max_temp: 34,
          avg_max_rain: 4,
          avg_max_aqi: 230,
          daily: {
            apparent_temperature_max: [34],
            precipitation_sum: [4],
            daily_max_aqi: [230]
          }
        };
      }
    },
    nowProvider: () => new Date("2026-04-01T12:00:00Z")
  });
  const app = buildApp({ dataStore, dashboardService });
  const token = createAuthToken("44444444-4444-4444-8444-555555555555", "9345678123");

  const response = await invokeApp(app, {
    method: "GET",
    url: "/api/dashboard",
    headers: {
      authorization: `Bearer ${token}`
    }
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.rider.zone_name, "Patrapada");
  assert.equal(response.body.zone_weather.current_aqi, 230);
  assert.equal(response.body.zone_weather.status, "threshold_breached");
});
