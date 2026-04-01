const test = require("node:test");
const assert = require("node:assert/strict");
const { buildApp } = require("../src/app");
const { invokeApp } = require("./http-test-utils");

test("rider-facing routes reject missing or invalid JWTs with 401", async () => {
  const app = buildApp({
    quoteService: {
      async generateQuote() {
        return { quote: { id: "unused" } };
      }
    }
  });

  const missingAuthCases = [
    { method: "POST", url: "/api/quotes/generate", body: { week_start: "2026-04-06" } },
    { method: "GET", url: "/api/policies/current" },
    { method: "GET", url: "/api/policies/history" },
    { method: "GET", url: "/api/claims" },
    { method: "GET", url: "/api/wallet" }
  ];

  for (const request of missingAuthCases) {
    const response = await invokeApp(app, {
      ...request,
      headers: request.body ? { "content-type": "application/json" } : {}
    });

    assert.equal(response.status, 401);
    assert.deepEqual(response.body, {
      error: "unauthorized",
      message: "Missing or invalid authorization header"
    });
  }

  const invalidTokenResponse = await invokeApp(app, {
    method: "GET",
    url: "/api/wallet",
    headers: {
      authorization: "Bearer definitely-not-a-jwt"
    }
  });

  assert.equal(invalidTokenResponse.status, 401);
  assert.deepEqual(invalidTokenResponse.body, {
    error: "unauthorized",
    message: "Missing or invalid authorization header"
  });
});
