const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const { buildApp } = require("../src/app");
const { WalletService } = require("../src/services/wallet-service");
const { ClaimsEngine } = require("../src/services/claims-engine");
const { ClaimsReadService } = require("../src/services/claims-read-service");
const { getConfig } = require("../src/utils/config");
const { createTestDataStore } = require("./test-helpers");
const { invokeApp } = require("./http-test-utils");

function createAuthToken(riderId, phone) {
  return jwt.sign({ rider_id: riderId, phone }, getConfig().jwtSecret, { expiresIn: "7d" });
}

test("Stateful sequence invariants hold across repeated successful and failed mutations", async () => {
  const { dataStore } = createTestDataStore();
  const walletService = new WalletService({ dataStore });
  const claimsEngine = new ClaimsEngine({
    dataStore,
    walletService,
    nowProvider: () => new Date("2026-03-31T14:45:00Z")
  });
  const claimsReadService = new ClaimsReadService({ dataStore });
  const app = buildApp({ dataStore, walletService, claimsEngine, claimsReadService });
  const token = createAuthToken("11111111-1111-4111-8111-111111111111", "9876543210");

  const steps = [
    { url: "/api/wallet/topup", amount: 100, expectedBalance: 456 },
    { url: "/api/wallet/topup", amount: 40, expectedBalance: 496 },
    { url: "/api/wallet/withdraw", amount: 60, expectedBalance: 436 },
    { url: "/api/wallet/withdraw", amount: 1000, expectedError: "insufficient_balance", expectedBalance: 436 }
  ];

  for (const step of steps) {
    const response = await invokeApp(app, {
      method: "POST",
      url: step.url,
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      },
      body: {
        amount: step.amount
      }
    });

    if (step.expectedError) {
      assert.equal(response.status, 400);
      assert.equal(response.body.error, step.expectedError);
    } else {
      assert.equal(response.status, 200);
      assert.equal(response.body.wallet.balance, step.expectedBalance);
    }

    const walletRead = await invokeApp(app, {
      method: "GET",
      url: "/api/wallet",
      headers: {
        authorization: `Bearer ${token}`
      }
    });
    assert.equal(walletRead.body.wallet.balance, step.expectedBalance);
  }

  const finalWallet = await invokeApp(app, {
    method: "GET",
    url: "/api/wallet",
    headers: {
      authorization: `Bearer ${token}`
    }
  });

  assert.equal(finalWallet.body.wallet.balance, 436);
  assert.equal(finalWallet.body.transactions.length, 5);
});
