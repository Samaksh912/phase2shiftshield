const test = require("node:test");
const assert = require("node:assert/strict");
const { buildApp } = require("../src/app");
const { WalletService } = require("../src/services/wallet-service");
const { NotificationService } = require("../src/services/notification-service");
const { PolicyService } = require("../src/services/policy-service");
const { createTestDataStore } = require("./test-helpers");
const { createAuthToken, seedQuote } = require("./feature-helpers");
const { invokeApp } = require("./http-test-utils");

test("wallet-backed policy create should roll back debit if policy persistence fails", async () => {
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
  const walletBefore = await dataStore.getWalletByRiderId("11111111-1111-4111-8111-111111111111");
  const txBefore = await dataStore.listWalletTransactionsByRiderId("11111111-1111-4111-8111-111111111111");

  dataStore.createPolicy = async () => {
    throw new Error("simulated policy persistence failure");
  };

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

  const walletAfter = await dataStore.getWalletByRiderId("11111111-1111-4111-8111-111111111111");
  const txAfter = await dataStore.listWalletTransactionsByRiderId("11111111-1111-4111-8111-111111111111");
  const createdPolicy = await dataStore.getPolicyByRiderAndWeekStart(
    "11111111-1111-4111-8111-111111111111",
    "2026-04-06"
  );

  assert.equal(response.status, 500);
  assert.equal(createdPolicy, null);
  assert.equal(walletAfter.balance, walletBefore.balance);
  assert.equal(txAfter.length, txBefore.length);
});

test("policy create preserves the original persistence error if rollback also fails", async () => {
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

  dataStore.createPolicy = async () => {
    throw new Error("simulated policy persistence failure");
  };
  dataStore.rollbackWalletTransaction = async () => {
    throw new Error("simulated rollback failure");
  };

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

  assert.equal(response.status, 500);
  assert.equal(response.body.message, "simulated policy persistence failure");
});
