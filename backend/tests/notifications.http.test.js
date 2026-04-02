const test = require("node:test");
const assert = require("node:assert/strict");
const { buildApp } = require("../src/app");
const { createTestDataStore } = require("./test-helpers");
const { createAuthToken } = require("./feature-helpers");
const { invokeApp } = require("./http-test-utils");

test("GET /api/notifications returns rider-scoped notifications created by wallet actions", async () => {
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
    body: {
      amount: 120
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
      amount: 20
    }
  });

  const response = await invokeApp(app, {
    method: "GET",
    url: "/api/notifications?limit=20&offset=0",
    headers: {
      authorization: `Bearer ${token}`
    }
  });

  assert.equal(topupResponse.status, 200);
  assert.equal(withdrawResponse.status, 200);
  assert.equal(response.status, 200);
  assert.equal(response.body.notifications.length, 2);
  assert.equal(response.body.unread_count, 2);
  assert.equal(response.body.pagination.has_more, false);

  const types = response.body.notifications.map((notification) => notification.type).sort();
  assert.deepEqual(types, ["wallet_credited", "wallet_debited"]);
  assert.equal(response.body.notifications[0].is_read, false);
});
