const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const { buildApp } = require("../src/app");
const { getConfig } = require("../src/utils/config");
const { invokeApp } = require("./http-test-utils");
const { createTestDataStore } = require("./test-helpers");

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

test("GET /api/wallet returns pagination metadata required by the Phase 2 contract", async () => {
  const { dataStore } = createTestDataStore();
  const app = buildApp({ dataStore });
  const token = createAuthToken();

  const response = await invokeApp(app, {
    method: "GET",
    url: "/api/wallet",
    headers: {
      authorization: `Bearer ${token}`
    }
  });

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.pagination, {
    page: 1,
    total_pages: 1,
    has_more: false
  });
});

test("POST /api/wallet/topup credits wallet and returns updated balance with transaction", async () => {
  const { dataStore } = createTestDataStore();
  const app = buildApp({ dataStore });
  const token = createAuthToken();

  const response = await invokeApp(app, {
    method: "POST",
    url: "/api/wallet/topup",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: {
      amount: 120,
      reference_id: "topup-demo",
      description: "Manual top-up (demo)"
    }
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.wallet.balance, 476);
  assert.equal(response.body.transaction.type, "credit_topup");
  assert.equal(response.body.transaction.amount, 120);
});

test("POST /api/wallet/withdraw debits wallet and returns processing metadata", async () => {
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
      amount: 76,
      reference_id: "withdraw-demo",
      description: "Withdrawal to UPI (processing)"
    }
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.wallet.balance, 280);
  assert.equal(response.body.transaction.type, "debit_withdrawal");
  assert.equal(response.body.transaction.amount, -76);
  assert.equal(response.body.withdrawal_status, "processing");
  assert.equal(response.body.expected_completion, "24-48 hours");
});

test("POST /api/wallet/withdraw rejects insufficient balance", async () => {
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
      amount: 1000
    }
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.error, "insufficient_balance");
});

test("POST /api/wallet topup and withdraw reject invalid amounts", async () => {
  const { dataStore } = createTestDataStore();
  const app = buildApp({ dataStore });
  const token = createAuthToken();

  const topupResponse = await invokeApp(app, {
    method: "POST",
    url: "/api/wallet/topup",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: {
      amount: 0
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
      amount: -10
    }
  });

  assert.equal(topupResponse.status, 400);
  assert.equal(topupResponse.body.error, "validation_error");
  assert.match(topupResponse.body.message, /positive integer/);

  assert.equal(withdrawResponse.status, 400);
  assert.equal(withdrawResponse.body.error, "validation_error");
  assert.match(withdrawResponse.body.message, /positive integer/);
});
