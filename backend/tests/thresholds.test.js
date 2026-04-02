const test = require("node:test");
const assert = require("node:assert/strict");
const { resolveThresholdsForZone } = require("../src/utils/thresholds");
const zones = require("../seed/zones.json");

function getZone(zoneId) {
  const zone = zones.find((entry) => entry.id === zoneId);
  assert.ok(zone, `Missing zone ${zoneId}`);
  return zone;
}

test("threshold lookup returns default thresholds for zones without overrides", () => {
  const thresholds = resolveThresholdsForZone(getZone("koramangala"));

  assert.deepEqual(thresholds, {
    temp: 42,
    aqi: 301,
    rain: 15
  });
});

test("threshold lookup applies city-tier overrides", () => {
  const thresholds = resolveThresholdsForZone(getZone("bhubaneswar_patrapada"));

  assert.deepEqual(thresholds, {
    temp: 40,
    aqi: 220,
    rain: 12
  });
});

test("threshold lookup applies zone override over city-tier/default values", () => {
  const thresholds = resolveThresholdsForZone(getZone("whitefield"));

  assert.deepEqual(thresholds, {
    temp: 42,
    aqi: 290,
    rain: 15
  });
});
