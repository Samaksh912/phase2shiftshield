const fs = require("fs");
const { getConfig } = require("./config");

const DISRUPTION_DURATION_MINUTES = {
  heat: 120,
  aqi: 135,
  rain: 45
};

function loadThresholdConfig(config = getConfig()) {
  return JSON.parse(fs.readFileSync(config.thresholdsSeedPath, "utf8"));
}

function resolveThresholdsForZone(zone, thresholdConfig = loadThresholdConfig()) {
  const cityTier = zone.city_tier || zone.tier || "T1";
  const cityTierOverride = thresholdConfig.city_tier_overrides?.[cityTier] || {};
  const zoneOverride = thresholdConfig.zone_overrides?.[zone.id] || {};

  return {
    ...thresholdConfig.defaults,
    ...cityTierOverride,
    ...zoneOverride
  };
}

function getTriggerThreshold(triggerType, thresholds) {
  if (triggerType === "aqi") {
    return thresholds.aqi;
  }
  if (triggerType === "rain") {
    return thresholds.rain;
  }
  return thresholds.temp;
}

module.exports = {
  DISRUPTION_DURATION_MINUTES,
  loadThresholdConfig,
  resolveThresholdsForZone,
  getTriggerThreshold
};
