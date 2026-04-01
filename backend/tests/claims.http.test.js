const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const { buildApp } = require("../src/app");
const { WalletService } = require("../src/services/wallet-service");
const { ClaimsEngine } = require("../src/services/claims-engine");
const { ClaimsReadService } = require("../src/services/claims-read-service");
const { AdminService } = require("../src/services/admin-service");
const { getConfig } = require("../src/utils/config");
const { createTestDataStore } = require("./test-helpers");
const { invokeApp } = require("./http-test-utils");

test("simulate-trigger creates claim and wallet credit visible through claims and wallet APIs", async () => {
  const { dataStore } = createTestDataStore();
  const walletService = new WalletService({ dataStore });
  const claimsEngine = new ClaimsEngine({
    dataStore,
    walletService,
    nowProvider: () => new Date("2026-03-31T14:45:00Z")
  });
  const claimsReadService = new ClaimsReadService({ dataStore });
  const adminService = new AdminService({ dataStore, claimsEngine });
  const app = buildApp({ dataStore, walletService, claimsEngine, claimsReadService, adminService });

  const simulateResponse = await invokeApp(app, {
    method: "POST",
    url: "/api/admin/simulate-trigger",
    headers: {
      "content-type": "application/json"
    },
    body: {
      zone_id: "koramangala",
      trigger_type: "aqi",
      value: 342,
      shift_type: "dinner",
      payout_percent: 45
    }
  });

  assert.equal(simulateResponse.status, 201);
  assert.equal(simulateResponse.body.affected_policies_count, 1);
  assert.equal(simulateResponse.body.claims_paid_count, 1);
  assert.equal(simulateResponse.body.total_wallet_credited, 306);

  const token = jwt.sign(
    {
      rider_id: "11111111-1111-4111-8111-111111111111",
      phone: "9876543210"
    },
    getConfig().jwtSecret,
    { expiresIn: "7d" }
  );

  const claimsResponse = await invokeApp(app, {
    method: "GET",
    url: "/api/claims",
    headers: {
      authorization: `Bearer ${token}`
    }
  });

  assert.equal(claimsResponse.status, 200);
  assert.equal(claimsResponse.body.claims.length, 1);
  assert.equal(claimsResponse.body.claims[0].status, "paid");
  assert.equal(claimsResponse.body.claims[0].payout_amount, 306);

  const claimDetailResponse = await invokeApp(app, {
    method: "GET",
    url: `/api/claims/${claimsResponse.body.claims[0].id}`,
    headers: {
      authorization: `Bearer ${token}`
    }
  });

  assert.equal(claimDetailResponse.status, 200);
  assert.equal(claimDetailResponse.body.claim.id, claimsResponse.body.claims[0].id);

  const walletResponse = await invokeApp(app, {
    method: "GET",
    url: "/api/wallet",
    headers: {
      authorization: `Bearer ${token}`
    }
  });

  assert.equal(walletResponse.status, 200);
  assert.equal(walletResponse.body.wallet.balance, 662);
  assert.equal(walletResponse.body.transactions[0].type, "credit_payout");
  assert.equal(walletResponse.body.transactions[0].amount, 306);

  const walletTransactionsResponse = await invokeApp(app, {
    method: "GET",
    url: "/api/wallet/transactions",
    headers: {
      authorization: `Bearer ${token}`
    }
  });

  assert.equal(walletTransactionsResponse.status, 200);
  assert.equal(walletTransactionsResponse.body.transactions[0].type, "credit_payout");
});
