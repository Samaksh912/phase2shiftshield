const test = require("node:test");
const assert = require("node:assert/strict");
const { QuoteService } = require("../src/services/quote-service");
const { getNextMonday } = require("../src/utils/time");
const { createTestDataStore } = require("./test-helpers");

function setActiveDaysLast30(dataStore, phone, activeDaysLast30) {
  const store = dataStore.readStore();
  const platformRider = store.mock_platform_riders.find((rider) => rider.phone === phone);
  platformRider.active_days_last_30 = activeDaysLast30;
  dataStore.writeStore(store);
}

test("QuoteService.generateQuote returns contract-compliant quote data", async () => {
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
            top_factors: [
              {
                factor: "AQI forecast",
                contribution_pct: 47,
                detail: "2 days predicted AQI above 280"
              },
              {
                factor: "Rain probability",
                contribution_pct: 31,
                detail: "1 days forecast above 15mm rain"
              }
            ],
            summary: "Medium risk this week. 2 days predicted AQI above 280."
          }
        };
      }
    },
    weatherService: {
      async fetchWeeklyForecastSummary() {
        return {
          source: "fallback",
          avg_max_temp: 40.1,
          avg_max_rain: 7.8,
          avg_max_aqi: 242,
          daily: {
            apparent_temperature_max: [38, 39, 40, 41, 41, 40, 39],
            precipitation_sum: [0, 4, 10, 16, 11, 5, 2],
            daily_max_aqi: [188, 214, 261, 284, 272, 236, 218]
          }
        };
      }
    },
    nowProvider: () => new Date("2026-04-01T00:00:00Z")
  });

  const response = await quoteService.generateQuote({
    riderId: "11111111-1111-4111-8111-111111111111",
    weekStart: getNextMonday(new Date("2026-04-01T00:00:00Z"))
  });

  assert.equal(typeof response.quote.id, "string");
  assert.equal(response.quote.zone_id, "koramangala");
  assert.equal(response.quote.zone_name, "Koramangala");
  assert.equal(response.quote.shifts_covered, "both");
  assert.equal(response.quote.risk_band, "medium");
  assert.equal(response.quote.premium, 58);
  assert.equal(response.quote.coverage_breakdown.total_protected_shifts, 12);
  assert.equal(response.quote.can_purchase, true);
  assert.deepEqual(response.quote.underwriting, {
    status: "eligible",
    active_days_last_30: 9,
    message: "You are eligible to purchase or renew coverage."
  });
  assert.ok(Array.isArray(response.quote.explanation.top_factors));
  assert.equal("reason" in response.quote, false);
});

test("QuoteService.generateQuote keeps riders eligible at the 7-day underwriting threshold", async () => {
  const { dataStore } = createTestDataStore();
  setActiveDaysLast30(dataStore, "9876543210", 7);

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
            summary: "threshold quote"
          }
        };
      }
    },
    weatherService: {
      async fetchWeeklyForecastSummary() {
        return {
          source: "fallback",
          avg_max_temp: 40.1,
          avg_max_rain: 7.8,
          avg_max_aqi: 242,
          daily: {
            apparent_temperature_max: [38, 39, 40, 41, 41, 40, 39],
            precipitation_sum: [0, 4, 10, 16, 11, 5, 2],
            daily_max_aqi: [188, 214, 261, 284, 272, 236, 218]
          }
        };
      }
    },
    nowProvider: () => new Date("2026-04-01T00:00:00Z")
  });

  const response = await quoteService.generateQuote({
    riderId: "11111111-1111-4111-8111-111111111111",
    weekStart: "2026-04-06"
  });

  assert.equal(response.quote.can_purchase, true);
  assert.equal(response.quote.underwriting.status, "eligible");
  assert.equal(response.quote.underwriting.active_days_last_30, 7);
});

test("QuoteService.generateQuote returns insufficient_history underwriting at 5 and 6 active days", async () => {
  for (const activeDaysLast30 of [5, 6]) {
    const { dataStore } = createTestDataStore();
    setActiveDaysLast30(dataStore, "9876543210", activeDaysLast30);

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
              summary: "threshold quote"
            }
          };
        }
      },
      weatherService: {
        async fetchWeeklyForecastSummary() {
          return {
            source: "fallback",
            avg_max_temp: 40.1,
            avg_max_rain: 7.8,
            avg_max_aqi: 242,
            daily: {
              apparent_temperature_max: [38, 39, 40, 41, 41, 40, 39],
              precipitation_sum: [0, 4, 10, 16, 11, 5, 2],
              daily_max_aqi: [188, 214, 261, 284, 272, 236, 218]
            }
          };
        }
      },
      nowProvider: () => new Date("2026-04-01T00:00:00Z")
    });

    const response = await quoteService.generateQuote({
      riderId: "11111111-1111-4111-8111-111111111111",
      weekStart: "2026-04-06"
    });

    assert.equal(response.quote.can_purchase, false);
    assert.deepEqual(response.quote.underwriting, {
      status: "insufficient_history",
      active_days_last_30: activeDaysLast30,
      message: "At least 7 active delivery days in the last 30 days are required to purchase or renew coverage."
    });
    assert.equal(
      response.quote.reason,
      "At least 7 active delivery days in the last 30 days are required to purchase or renew coverage."
    );
  }
});

test("QuoteService.generateQuote returns restricted underwriting below 5 active days", async () => {
  const { dataStore } = createTestDataStore();
  setActiveDaysLast30(dataStore, "9876543210", 4);

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
            summary: "threshold quote"
          }
        };
      }
    },
    weatherService: {
      async fetchWeeklyForecastSummary() {
        return {
          source: "fallback",
          avg_max_temp: 40.1,
          avg_max_rain: 7.8,
          avg_max_aqi: 242,
          daily: {
            apparent_temperature_max: [38, 39, 40, 41, 41, 40, 39],
            precipitation_sum: [0, 4, 10, 16, 11, 5, 2],
            daily_max_aqi: [188, 214, 261, 284, 272, 236, 218]
          }
        };
      }
    },
    nowProvider: () => new Date("2026-04-01T00:00:00Z")
  });

  const response = await quoteService.generateQuote({
    riderId: "11111111-1111-4111-8111-111111111111",
    weekStart: "2026-04-06"
  });

  assert.equal(response.quote.can_purchase, false);
  assert.deepEqual(response.quote.underwriting, {
    status: "restricted",
    active_days_last_30: 4,
    message: "Coverage is restricted because you have fewer than 5 active delivery days in the last 30 days."
  });
  assert.equal(
    response.quote.reason,
    "Coverage is restricted because you have fewer than 5 active delivery days in the last 30 days."
  );
});

test("QuoteService.generateQuote uses active_days_per_week fallback without skipping insufficient_history", async () => {
  const { dataStore } = createTestDataStore();
  const store = dataStore.readStore();
  const platformRider = store.mock_platform_riders.find((rider) => rider.phone === "9876543210");
  delete platformRider.active_days_last_30;
  platformRider.active_days_per_week = 5;
  dataStore.writeStore(store);

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
            summary: "fallback threshold quote"
          }
        };
      }
    },
    weatherService: {
      async fetchWeeklyForecastSummary() {
        return {
          source: "fallback",
          avg_max_temp: 40.1,
          avg_max_rain: 7.8,
          avg_max_aqi: 242,
          daily: {
            apparent_temperature_max: [38, 39, 40, 41, 41, 40, 39],
            precipitation_sum: [0, 4, 10, 16, 11, 5, 2],
            daily_max_aqi: [188, 214, 261, 284, 272, 236, 218]
          }
        };
      }
    },
    nowProvider: () => new Date("2026-04-01T00:00:00Z")
  });

  const response = await quoteService.generateQuote({
    riderId: "11111111-1111-4111-8111-111111111111",
    weekStart: "2026-04-06"
  });

  assert.equal(response.quote.can_purchase, false);
  assert.deepEqual(response.quote.underwriting, {
    status: "insufficient_history",
    active_days_last_30: 5,
    message: "At least 7 active delivery days in the last 30 days are required to purchase or renew coverage."
  });
});

test("QuoteService.generateQuote includes user-facing reason when an active disruption blocks purchase", async () => {
  const { dataStore } = createTestDataStore();
  const quoteService = new QuoteService({
    dataStore,
    mlClient: {
      async predictPremium() {
        return {
          risk_score: 0.61,
          risk_band: "medium",
          premium: 64,
          payout_cap: 4800,
          lunch_shift_max_payout: 336,
          dinner_shift_max_payout: 544,
          explanation: {
            top_factors: [
              {
                factor: "Historical triggers",
                contribution_pct: 100,
                detail: "1 triggers in the last 4 weeks"
              }
            ],
            summary: "Medium risk this week. 1 triggers in the last 4 weeks."
          }
        };
      }
    },
    weatherService: {
      async fetchWeeklyForecastSummary() {
        return {
          source: "fallback",
          avg_max_temp: 40.1,
          avg_max_rain: 7.8,
          avg_max_aqi: 242,
          daily: {
            apparent_temperature_max: [38, 39, 40, 41, 41, 40, 39],
            precipitation_sum: [0, 4, 10, 16, 11, 5, 2],
            daily_max_aqi: [188, 214, 261, 284, 272, 236, 218]
          }
        };
      }
    },
    nowProvider: () => new Date("2026-04-01T00:00:00Z")
  });

  const originalHasActiveDisruption = quoteService.dataStore.hasActiveDisruption.bind(quoteService.dataStore);
  quoteService.dataStore.hasActiveDisruption = async () => true;

  const response = await quoteService.generateQuote({
    riderId: "11111111-1111-4111-8111-111111111111",
    weekStart: "2026-04-06"
  });

  assert.equal(response.quote.can_purchase, false);
  assert.equal(
    response.quote.reason,
    "An active disruption event is detected in your zone. Policy purchase is temporarily unavailable."
  );

  quoteService.dataStore.hasActiveDisruption = originalHasActiveDisruption;
});

test("QuoteService.generateQuote rejects a stale Monday once it is no longer the next upcoming Monday", async () => {
  const { dataStore } = createTestDataStore();
  const quoteService = new QuoteService({
    dataStore,
    mlClient: {
      async predictPremium() {
        return {
          risk_score: 0.44,
          risk_band: "medium",
          premium: 51,
          payout_cap: 4800,
          lunch_shift_max_payout: 336,
          dinner_shift_max_payout: 544,
          explanation: {
            top_factors: [
              {
                factor: "Rain probability",
                contribution_pct: 100,
                detail: "1 days forecast above 15mm rain"
              }
            ],
            summary: "Medium risk this week. 1 days forecast above 15mm rain."
          }
        };
      }
    },
    weatherService: {
      async fetchWeeklyForecastSummary() {
        return {
          source: "fallback",
          avg_max_temp: 40.1,
          avg_max_rain: 7.8,
          avg_max_aqi: 242,
          daily: {
            apparent_temperature_max: [38, 39, 40, 41, 41, 40, 39],
            precipitation_sum: [0, 4, 10, 16, 11, 5, 2],
            daily_max_aqi: [188, 214, 261, 284, 272, 236, 218]
          }
        };
      }
    },
    nowProvider: () => new Date("2026-04-06T00:00:00Z")
  });

  await assert.rejects(
    () =>
      quoteService.generateQuote({
        riderId: "11111111-1111-4111-8111-111111111111",
        weekStart: "2026-04-06"
      }),
    /next upcoming Monday/
  );
});
