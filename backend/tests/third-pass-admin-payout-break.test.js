const test = require("node:test");
const assert = require("node:assert/strict");
const { buildApp } = require("../src/app");
const { createTestDataStore } = require("./test-helpers");
const { invokeApp } = require("./http-test-utils");

test("POST /api/admin/simulate-trigger rejects non-integer and out-of-range payout_percent values", async () => {
  const invalidCases = [-10, 0, 19, 80.5, 81, 1000];

  for (const payoutPercent of invalidCases) {
    const { dataStore } = createTestDataStore();
    const app = buildApp({ dataStore });

    const response = await invokeApp(app, {
      method: "POST",
      url: "/api/admin/simulate-trigger",
      headers: {
        "content-type": "application/json"
      },
      body: {
        zone_id: "koramangala",
        trigger_type: "aqi",
        shift_type: "dinner",
        payout_percent: payoutPercent,
        value: 350
      }
    });

    assert.equal(response.status, 400);
    assert.deepEqual(response.body, {
      error: "validation_error",
      message: "payout_percent must be an integer between 20 and 80"
    });
  }
});
