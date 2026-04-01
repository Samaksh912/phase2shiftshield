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

test("POST /api/wallet/withdraw matches the Phase 2 expected_completion contract", async () => {
  const { dataStore } = createTestDataStore();
  const app = buildApp({ dataStore });
  const token = createAuthToken();

  const response = await invokeApp(app, {
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

  assert.equal(response.status, 200);
  assert.equal(response.body.withdrawal_status, "processing");
  assert.equal(response.body.expected_completion, "24-48 hours");
});
