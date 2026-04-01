const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const { buildApp } = require("../src/app");
const { QuoteService } = require("../src/services/quote-service");
const { ClaimsEngine } = require("../src/services/claims-engine");
const { WalletService } = require("../src/services/wallet-service");
const { getConfig } = require("../src/utils/config");
const { createTestDataStore } = require("./test-helpers");
const { invokeApp } = require("./http-test-utils");

function createAuthToken(riderId, phone) {
  return jwt.sign({ rider_id: riderId, phone }, getConfig().jwtSecret, { expiresIn: "7d" });
}

test("QuoteService returns not_found for missing rider and missing zone", async () => {
  const { dataStore } = createTestDataStore();
  const baseDeps = {
    mlClient: {
      async predictPremium() {
        return {
          risk_score: 0.52,
          risk_band: "medium",
          premium: 58,
          payout_cap: 4800,
          lunch_shift_max_payout: 336,
          dinner_shift_max_payout: 544,
          explanation: { top_factors: [], summary: "ok" }
        };
      }
    },
    weatherService: {
      async fetchWeeklyForecastSummary() {
        return { source: "fallback" };
      }
    },
    nowProvider: () => new Date("2026-04-01T00:00:00Z")
  };

  const quoteService = new QuoteService({ dataStore, ...baseDeps });
  await assert.rejects(
    () =>
      quoteService.generateQuote({
        riderId: "missing-rider",
        weekStart: "2026-04-06"
      }),
    /Rider profile not found/
  );

  const store = dataStore.readStore();
  store.riders[0].zone_id = "missing-zone";
  dataStore.writeStore(store);

  await assert.rejects(
    () =>
      quoteService.generateQuote({
        riderId: "11111111-1111-4111-8111-111111111111",
        weekStart: "2026-04-06"
      }),
    /Rider zone not found/
  );
});

test("ClaimsEngine uses IST date rollover for claim_date", async () => {
  const { dataStore } = createTestDataStore();
  const walletService = new WalletService({ dataStore });
  const claimsEngine = new ClaimsEngine({
    dataStore,
    walletService,
    // 2026-03-31T18:31:00Z == 2026-04-01 00:01 IST
    nowProvider: () => new Date("2026-03-31T18:31:00Z")
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

  assert.equal(result.claim_date, "2026-04-01");
  assert.equal(result.claims_paid_count, 1);
});

test("Wallet repeated updates preserve final balance and descending transaction order", async () => {
  const { dataStore } = createTestDataStore();
  const app = buildApp({ dataStore });
  const token = createAuthToken("11111111-1111-4111-8111-111111111111", "9876543210");

  const topupResponse = await invokeApp(app, {
    method: "POST",
    url: "/api/wallet/topup",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: { amount: 100 }
  });
  assert.equal(topupResponse.status, 200);

  const withdrawResponse = await invokeApp(app, {
    method: "POST",
    url: "/api/wallet/withdraw",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: { amount: 60 }
  });
  assert.equal(withdrawResponse.status, 200);

  const walletResponse = await invokeApp(app, {
    method: "GET",
    url: "/api/wallet",
    headers: {
      authorization: `Bearer ${token}`
    }
  });

  assert.equal(walletResponse.status, 200);
  assert.equal(walletResponse.body.wallet.balance, 396);
  assert.equal(walletResponse.body.transactions[0].type, "debit_withdrawal");
  assert.equal(walletResponse.body.transactions[1].type, "credit_topup");
});

test("Rider wallet reads stay isolated to the authenticated rider", async () => {
  const { dataStore } = createTestDataStore();
  const app = buildApp({ dataStore });
  const riderTwoToken = createAuthToken("22222222-2222-4222-8222-222222222222", "9123456780");

  const response = await invokeApp(app, {
    method: "GET",
    url: "/api/wallet",
    headers: {
      authorization: `Bearer ${riderTwoToken}`
    }
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.wallet.id, "wallet-rohan");
  assert.equal(response.body.wallet.balance, 50);
});
