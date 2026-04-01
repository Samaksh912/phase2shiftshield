const test = require("node:test");
const assert = require("node:assert/strict");
const { QuoteService } = require("../src/services/quote-service");
const { createTestDataStore } = require("./test-helpers");

test("QuoteService allows purchase exactly at the configured purchase_deadline instant", async () => {
  const { dataStore } = createTestDataStore();
  const quoteService = new QuoteService({
    dataStore,
    mlClient: {
      async predictPremium() {
        return {
          risk_score: 0.52,
          risk_band: "medium",
          premium: 58,
          payout_cap: 4800,
          lunch_shift_max_payout: 336,
          dinner_shift_max_payout: 544,
          explanation: {
            top_factors: [],
            summary: "Boundary test quote"
          }
        };
      }
    },
    weatherService: {
      async fetchWeeklyForecastSummary() {
        return { source: "fallback" };
      }
    },
    // 2026-04-05T18:29:00Z == 2026-04-05 23:59:00 IST
    nowProvider: () => new Date("2026-04-05T18:29:00Z")
  });

  const response = await quoteService.generateQuote({
    riderId: "11111111-1111-4111-8111-111111111111",
    weekStart: "2026-04-06"
  });

  assert.equal(response.quote.can_purchase, true);
  assert.equal("reason" in response.quote, false);
});
