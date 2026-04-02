const test = require("node:test");
const assert = require("node:assert/strict");
const { QuoteService } = require("../src/services/quote-service");
const { WeatherService } = require("../src/services/weather-service");
const { createTestDataStore } = require("./test-helpers");

test("Phase 2.5 seed geography loads at least 10 supported zones", async () => {
  const { dataStore } = createTestDataStore();
  const store = dataStore.readStore();

  assert.ok(store.zones.length >= 10);
});

test("Phase 3 hierarchy seed exposes cities and valid city-linked zones", async () => {
  const { dataStore } = createTestDataStore();
  const store = dataStore.readStore();
  const citiesById = new Map(store.cities.map((city) => [city.id, city]));

  assert.ok(store.cities.length >= 8);
  assert.ok(store.zones.every((zone) => typeof zone.city_id === "string" && citiesById.has(zone.city_id)));
  assert.equal(store.zones.filter((zone) => zone.city_id === "bengaluru").length, 5);
});

test("Phase 2.5 seed geography includes explicit city tier metadata", async () => {
  const { dataStore } = createTestDataStore();
  const store = dataStore.readStore();

  assert.ok(store.zones.every((zone) => ["T1", "T2", "T3"].includes(zone.city_tier)));
});

test("An eligible non-T1 seeded rider is visible in the effective runtime store", async () => {
  const { dataStore } = createTestDataStore();
  const store = dataStore.readStore();

  const rider = store.riders.find((entry) => entry.id === "44444444-4444-4444-8444-555555555555");
  const platformRider = store.mock_platform_riders.find((entry) => entry.phone === "9345678123");
  const zone = store.zones.find((entry) => entry.id === "bhubaneswar_patrapada");

  assert.ok(rider);
  assert.ok(platformRider);
  assert.equal(rider.platform, "swiggy");
  assert.equal(rider.zone_id, "bhubaneswar_patrapada");
  assert.equal(platformRider.platform, "swiggy");
  assert.equal(platformRider.active_days_last_30, 8);
  assert.equal(zone.city_tier, "T3");
});

test("A seeded T2 rider is visible and demo-ready in the effective runtime store", async () => {
  const { dataStore } = createTestDataStore();
  const store = dataStore.readStore();

  const rider = store.riders.find((entry) => entry.id === "55555555-5555-4555-8555-666666666666");
  const platformRider = store.mock_platform_riders.find((entry) => entry.phone === "9451203344");
  const zone = store.zones.find((entry) => entry.id === "lucknow_gomti_nagar");
  const wallet = store.wallets.find((entry) => entry.rider_id === "55555555-5555-4555-8555-666666666666");

  assert.ok(rider);
  assert.ok(platformRider);
  assert.ok(wallet);
  assert.equal(rider.platform, "zomato");
  assert.equal(rider.zone_id, "lucknow_gomti_nagar");
  assert.equal(platformRider.active_days_last_30, 8);
  assert.equal(zone.city_tier, "T2");
  assert.equal(wallet.balance, 210);
});

test("Swiggy/Zomato platform seeds remain compatible with the expanded geography quote path", async () => {
  const { dataStore } = createTestDataStore();
  const originalFetch = global.fetch;
  global.fetch = async () => {
    throw new Error("network disabled for test");
  };

  try {
    const weatherService = new WeatherService();
    const quoteService = new QuoteService({
      dataStore,
      weatherService,
      mlClient: {
        async predictPremium(payload) {
          assert.equal(payload.zone_id, "pune_hinjewadi");
          return {
            risk_score: 0.36,
            risk_band: "medium",
            premium: 34,
            payout_cap: 4920,
            lunch_shift_max_payout: 312,
            dinner_shift_max_payout: 512,
            explanation: {
              top_factors: [],
              summary: "Phase 2.5 expanded geography seeded quote"
            }
          };
        }
      },
      nowProvider: () => new Date("2026-04-02T00:00:00Z")
    });

    const response = await quoteService.generateQuote({
      riderId: "33333333-3333-4333-8333-444444444444",
      weekStart: "2026-04-06"
    });

    const store = dataStore.readStore();
    const platformRider = store.mock_platform_riders.find((rider) => rider.phone === "9988776655");
    const platformSet = new Set(store.mock_platform_riders.map((rider) => rider.platform));

    assert.deepEqual([...platformSet].sort(), ["swiggy", "zomato"]);
    assert.equal(platformRider.platform, "zomato");
    assert.equal(platformRider.zone_id, "pune_hinjewadi");
    assert.equal(response.quote.zone_id, "pune_hinjewadi");
    assert.equal(response.quote.zone_name, "Hinjewadi");
    assert.equal(response.quote.premium, 34);
  } finally {
    global.fetch = originalFetch;
  }
});
