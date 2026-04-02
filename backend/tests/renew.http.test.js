const test = require("node:test");
const assert = require("node:assert/strict");
const { buildApp } = require("../src/app");
const { WalletService } = require("../src/services/wallet-service");
const { NotificationService } = require("../src/services/notification-service");
const { PolicyService } = require("../src/services/policy-service");
const { createTestDataStore } = require("./test-helpers");
const { createAuthToken, seedQuote } = require("./feature-helpers");
const { invokeApp } = require("./http-test-utils");

function setActiveDaysLast30(dataStore, phone, activeDaysLast30) {
  const store = dataStore.readStore();
  const platformRider = store.mock_platform_riders.find((rider) => rider.phone === phone);
  platformRider.active_days_last_30 = activeDaysLast30;
  dataStore.writeStore(store);
}

test("POST /api/policies/:id/renew creates a next-week policy using existing purchase rules", async () => {
  const { dataStore } = createTestDataStore();
  const walletService = new WalletService({ dataStore });
  const notificationService = new NotificationService({ dataStore });
  const policyService = new PolicyService({
    dataStore,
    walletService,
    notificationService,
    nowProvider: () => new Date("2026-04-04T12:00:00Z")
  });
  const app = buildApp({ dataStore, walletService, notificationService, policyService });
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

  assert.equal(response.status, 201);
  assert.equal(response.body.policy.week_start, "2026-04-06");
  assert.equal(response.body.policy.status, "scheduled");
  assert.equal(response.body.wallet.balance, 296);
  assert.equal(response.body.transaction.type, "debit_premium");
});

test("POST /api/policies/:id/renew prevents duplicate same-week policy creation", async () => {
  const { dataStore } = createTestDataStore();
  const walletService = new WalletService({ dataStore });
  const notificationService = new NotificationService({ dataStore });
  const policyService = new PolicyService({
    dataStore,
    walletService,
    notificationService,
    nowProvider: () => new Date("2026-04-04T12:00:00Z")
  });
  const app = buildApp({ dataStore, walletService, notificationService, policyService });
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

  const firstResponse = await invokeApp(app, {
    method: "POST",
    url: "/api/policies/policy-asha-active/renew",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: {
      quote_id: quote.id,
      payment_method: "direct"
    }
  });

  const secondResponse = await invokeApp(app, {
    method: "POST",
    url: "/api/policies/policy-asha-active/renew",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: {
      quote_id: quote.id,
      payment_method: "direct"
    }
  });

  assert.equal(firstResponse.status, 201);
  assert.equal(secondResponse.status, 409);
  assert.equal(secondResponse.body.error, "policy_exists");
});

test("POST /api/policies/:id/renew rejects restricted underwriting states", async () => {
  const { dataStore } = createTestDataStore();
  setActiveDaysLast30(dataStore, "9876543210", 4);
  const walletService = new WalletService({ dataStore });
  const notificationService = new NotificationService({ dataStore });
  const policyService = new PolicyService({
    dataStore,
    walletService,
    notificationService,
    nowProvider: () => new Date("2026-04-04T12:00:00Z")
  });
  const app = buildApp({ dataStore, walletService, notificationService, policyService });
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
    url: "/api/policies/policy-asha-active/renew",
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
  assert.equal(response.body.error, "restricted");
  assert.equal(
    response.body.message,
    "Coverage is restricted because you have fewer than 5 active delivery days in the last 30 days."
  );
});
