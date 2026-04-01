const test = require("node:test");
const assert = require("node:assert/strict");
const { QuoteService } = require("../src/services/quote-service");
const { createTestDataStore } = require("./test-helpers");

test("QuoteService keeps the contract shape by always returning explanation", async () => {
  const { dataStore } = createTestDataStore();
  const quoteService = new QuoteService({
    dataStore,
    mlClient: {
      async predictPremium() {
        return {
          risk_score: 0.4,
          risk_band: "medium",
          premium: 52,
          payout_cap: 2400,
          lunch_shift_max_payout: 84,
          dinner_shift_max_payout: 544
        };
      }
    },
    weatherService: {
      async fetchWeeklyForecastSummary() {
        return { source: "fallback" };
      }
    },
    nowProvider: () => new Date("2026-04-01T00:00:00Z")
  });

  const response = await quoteService.generateQuote({
    riderId: "11111111-1111-4111-8111-111111111111",
    weekStart: "2026-04-06"
  });

  assert.deepEqual(response.quote.explanation, {
    top_factors: [],
    summary: ""
  });
});
