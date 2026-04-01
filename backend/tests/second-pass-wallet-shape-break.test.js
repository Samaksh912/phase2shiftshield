const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const { buildApp } = require("../src/app");
const { getConfig } = require("../src/utils/config");
const { createTestDataStore } = require("./test-helpers");
const { invokeApp } = require("./http-test-utils");

function createAuthToken() {
  return jwt.sign(
    {
      rider_id: "11111111-1111-4111-8111-111111111111",
      phone: "9876543210"
    },
    getConfig().jwtSecret,
    { expiresIn: "7d" }
  );
}

test("Wallet APIs do not leak internal storage-only transaction fields", async () => {
  const { dataStore } = createTestDataStore();
  const app = buildApp({ dataStore });
  const token = createAuthToken();

  const walletResponse = await invokeApp(app, {
    method: "GET",
    url: "/api/wallet",
    headers: {
      authorization: `Bearer ${token}`
    }
  });

  const withdrawResponse = await invokeApp(app, {
    method: "POST",
    url: "/api/wallet/withdraw",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: {
      amount: 10
    }
  });

  const expectedTransactionKeys = ["amount", "created_at", "description", "id", "type"];

  assert.deepEqual(Object.keys(walletResponse.body.transactions[0]).sort(), expectedTransactionKeys);
  assert.deepEqual(Object.keys(withdrawResponse.body.transaction).sort(), expectedTransactionKeys);
});
