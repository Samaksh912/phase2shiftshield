const test = require("node:test");
const assert = require("node:assert/strict");
const { QuoteService } = require("../src/services/quote-service");
const { createTestDataStore } = require("./test-helpers");

test("QuoteService enforces the spec rule that week_start must be the next upcoming Monday", async () => {
  const { dataStore } = createTestDataStore();
  const quoteService = new QuoteService({
    dataStore,
    mlClient: {
      async predictPremium() {
        return {
          risk_score: 0.5,
          risk_band: "medium",
          premium: 50,
          payout_cap: 1000,
          lunch_shift_max_payout: 100,
          dinner_shift_max_payout: 200,
          explanation: {
            top_factors: [],
            summary: "Test quote"
          }
        };
      }
    },
    weatherService: {
      async fetchWeeklyForecastSummary() {
        return {
          source: "test"
        };
      }
    },
    nowProvider: () => new Date("2026-04-01T00:00:00Z")
  });

  await assert.rejects(
    () =>
      quoteService.generateQuote({
        riderId: "11111111-1111-4111-8111-111111111111",
        weekStart: "2026-04-13"
      }),
    /next upcoming Monday/
  );
});
