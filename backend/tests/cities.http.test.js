const test = require("node:test");
const assert = require("node:assert/strict");
const { buildApp } = require("../src/app");
const { createTestDataStore } = require("./test-helpers");
const { invokeApp } = require("./http-test-utils");

test("GET /api/cities returns city records with grouped zones", async () => {
  const { dataStore } = createTestDataStore();
  const app = buildApp({ dataStore });

  const response = await invokeApp(app, {
    method: "GET",
    url: "/api/cities"
  });

  assert.equal(response.status, 200);
  assert.ok(Array.isArray(response.body.cities));
  assert.ok(response.body.cities.length >= 8);

  const lucknow = response.body.cities.find((city) => city.id === "lucknow");
  assert.ok(lucknow);
  assert.equal(lucknow.city_tier, "T2");
  assert.ok(Array.isArray(lucknow.zones));
  assert.deepEqual(lucknow.zones, [
    {
      id: "lucknow_gomti_nagar",
      name: "Gomti Nagar",
      city_id: "lucknow",
      city_tier: "T2",
      risk_class: "medium"
    }
  ]);
});
