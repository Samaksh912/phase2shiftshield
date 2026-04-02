const test = require("node:test");
const assert = require("node:assert/strict");
const { buildApp } = require("../src/app");
const { createTestDataStore } = require("./test-helpers");
const { invokeApp } = require("./http-test-utils");

test("POST /api/admin/simulate-trigger rejects an unknown zone_id", async () => {
  const { dataStore } = createTestDataStore();
  const app = buildApp({ dataStore });

  const response = await invokeApp(app, {
    method: "POST",
    url: "/api/admin/simulate-trigger",
    headers: {
      "content-type": "application/json"
    },
    body: {
      zone_id: "does-not-exist",
      trigger_type: "aqi",
      shift_type: "dinner",
      value: 350
    }
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.error, "validation_error");
});

test("POST /api/admin/simulate-trigger rejects an unsupported trigger_type", async () => {
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
      trigger_type: "bogus",
      shift_type: "dinner",
      value: 350
    }
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.error, "validation_error");
});

test("POST /api/admin/simulate-trigger rejects an unsupported shift_type", async () => {
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
      shift_type: "overnight",
      value: 350
    }
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.error, "validation_error");
});

test("POST /api/admin/simulate-trigger uses geography-specific thresholds in trigger metadata", async () => {
  const { dataStore } = createTestDataStore();
  const app = buildApp({ dataStore });

  const response = await invokeApp(app, {
    method: "POST",
    url: "/api/admin/simulate-trigger",
    headers: {
      "content-type": "application/json"
    },
    body: {
      zone_id: "bhubaneswar_patrapada",
      trigger_type: "aqi",
      shift_type: "dinner",
      value: 230
    }
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.trigger_event.zone_id, "bhubaneswar_patrapada");
  assert.equal(response.body.trigger_event.condition_a_data.threshold, 220);
});
