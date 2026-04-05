/**
 * Inline ML pricing engine — ported from backend/ml-service/model/predict.py
 *
 * Replaces the separate Python/FastAPI ML microservice so the backend has
 * no external dependency for quote generation. Weather data is still fetched
 * live from Open Meteo (free, no auth required), with a deterministic
 * fallback when the API is unavailable.
 *
 * Premium output is always in the range ₹20–₹50 (same as the Python service).
 */

"use strict";

const path = require("path");
const fs = require("fs");

// ─── Constants (mirror predict.py) ───────────────────────────────────────────
const LOADING_FACTOR = parseFloat(process.env.PREMIUM_LOADING_FACTOR || "0.35");
const LEGACY_PREMIUM_FLOOR = 15;
const LEGACY_PREMIUM_CEILING = 150;
const TARGET_PREMIUM_FLOOR = 20;
const TARGET_PREMIUM_CEILING = 50;
const RAW_SIGNAL_WEIGHT = 0.45;
const TIER_BASE_SCORE = { T1: 0.16, T2: 0.08, T3: 0.02 };
const ZONE_RISK_BASE_SCORE = { high: 0.20, medium: 0.10, low: 0.00 };
const WEATHER_DYNAMIC_WEIGHT = 0.18;

const OPEN_METEO_WEATHER_URL =
  process.env.OPEN_METEO_WEATHER_URL ||
  "https://api.open-meteo.com/v1/forecast";
const OPEN_METEO_AQI_URL =
  process.env.OPEN_METEO_AQI_URL ||
  "https://air-quality-api.open-meteo.com/v1/air-quality";

// ─── Seed data loading ────────────────────────────────────────────────────────

function resolveSeedPath(filename) {
  // Walk up from this file looking for backend/seed/<filename> or seed/<filename>
  let dir = path.resolve(__dirname);
  for (let i = 0; i < 8; i++) {
    const nested = path.join(dir, "backend", "seed", filename);
    if (fs.existsSync(nested)) return nested;
    const direct = path.join(dir, "seed", filename);
    if (fs.existsSync(direct)) return direct;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`Cannot locate seed file: ${filename}`);
}

function loadSeedData() {
  const cities = JSON.parse(fs.readFileSync(resolveSeedPath("cities.json"), "utf8"));
  const zones = JSON.parse(fs.readFileSync(resolveSeedPath("zones.json"), "utf8"));

  const cityMap = {};
  for (const c of cities) cityMap[c.id] = c;

  const zoneMap = {};
  for (const z of zones) {
    const city = cityMap[z.city_id];
    if (!city) throw new Error(`Zone ${z.id} references unknown city_id ${z.city_id}`);
    zoneMap[z.id] = {
      ...z,
      city_name: city.name,
      city_tier: z.city_tier || z.tier || city.city_tier,
    };
  }

  // Stable ordering for zone encoding (matches Python enumerate order)
  const zoneEncoding = {};
  Object.keys(zoneMap).forEach((id, idx) => { zoneEncoding[id] = idx; });

  return { cityMap, zoneMap, zoneEncoding };
}

const { cityMap, zoneMap, zoneEncoding } = loadSeedData();

// ─── Season helper ────────────────────────────────────────────────────────────

function getSeason(weekOfYear) {
  if (weekOfYear >= 22 && weekOfYear <= 39) return 2; // monsoon
  if (weekOfYear >= 9  && weekOfYear <= 21) return 1; // summer
  if (weekOfYear >= 40 && weekOfYear <= 48) return 3; // post-monsoon
  return 0;                                            // winter
}

// ─── Deterministic fallback forecast (mirrors build_fallback_forecast) ────────

function buildFallbackForecast(zone) {
  const tierTempBase = { T1: 39.5, T2: 37.5, T3: 35.5 }[zone.city_tier] || 38.0;
  const riskRainBase = { low: 4.0, medium: 7.0, high: 10.0 }[zone.risk_class] || 6.0;
  const riskAqiBase  = { low: 165.0, medium: 220.0, high: 275.0 }[zone.risk_class] || 200.0;

  const temperature = +(tierTempBase + (zone.avg_dinner_earnings - 500) / 120.0).toFixed(2);
  const rain        = +(riskRainBase + zone.avg_lunch_earnings / 180.0).toFixed(2);
  const aqi         = +(riskAqiBase  + (zone.city_tier === "T1" ? 18 : zone.city_tier === "T2" ? 8 : 0)).toFixed(2);

  return {
    avg_max_temp: temperature,
    avg_max_rain: rain,
    avg_max_aqi:  aqi,
    source: "fallback",
    daily: {
      apparent_temperature_max: [
        Math.round(temperature - 2), Math.round(temperature - 1),
        Math.round(temperature),     Math.round(temperature + 1),
        Math.round(temperature),     Math.round(temperature - 1),
        Math.round(temperature - 2),
      ],
      precipitation_sum: [
        Math.max(0, Math.round(rain - 4)), Math.max(0, Math.round(rain - 2)),
        Math.round(rain + 3),              Math.round(rain + 1),
        Math.max(0, Math.round(rain - 3)), Math.round(rain),
        Math.max(0, Math.round(rain - 2)),
      ],
      daily_max_aqi: [
        Math.round(aqi - 28), Math.round(aqi - 8),  Math.round(aqi + 12),
        Math.round(aqi + 22), Math.round(aqi + 6),  Math.round(aqi - 10),
        Math.round(aqi - 18),
      ],
    },
  };
}

// Pre-compute fallback forecasts for all zones at startup
const FALLBACK_FORECASTS = {};
for (const [id, zone] of Object.entries(zoneMap)) {
  FALLBACK_FORECASTS[id] = buildFallbackForecast(zone);
}

// ─── Live weather fetch (mirrors fetch_live_forecast) ─────────────────────────

function getDailyMaxAqi(hourlyValues) {
  const maxValues = [];
  for (let i = 0; i < 7; i++) {
    const block = hourlyValues.slice(i * 24, (i + 1) * 24).filter(v => v != null);
    maxValues.push(block.length ? Math.max(...block) : 50);
  }
  return maxValues;
}

function average(values, fallback) {
  const valid = values.filter(v => v != null && !isNaN(v));
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : fallback;
}

async function fetchLiveForecast(zone) {
  const weatherParams = new URLSearchParams({
    latitude: zone.lat,
    longitude: zone.lng,
    daily: "temperature_2m_max,apparent_temperature_max,precipitation_sum,weather_code",
    timezone: "Asia/Kolkata",
    forecast_days: "7",
  });
  const aqiParams = new URLSearchParams({
    latitude: zone.lat,
    longitude: zone.lng,
    hourly: "us_aqi",
    timezone: "Asia/Kolkata",
    forecast_days: "7",
  });

  const [weatherRes, aqiRes] = await Promise.all([
    fetch(`${OPEN_METEO_WEATHER_URL}?${weatherParams}`, { signal: AbortSignal.timeout(20000) }),
    fetch(`${OPEN_METEO_AQI_URL}?${aqiParams}`,         { signal: AbortSignal.timeout(20000) }),
  ]);

  if (!weatherRes.ok || !aqiRes.ok) throw new Error("Open Meteo returned non-2xx");

  const weather = await weatherRes.json();
  const aqi     = await aqiRes.json();
  const daily   = weather.daily || {};
  const dailyAqi = getDailyMaxAqi((aqi.hourly || {}).us_aqi || []);

  return {
    avg_max_temp: +average(daily.apparent_temperature_max || [], 38.0).toFixed(2),
    avg_max_rain: +average(daily.precipitation_sum       || [], 0.0).toFixed(2),
    avg_max_aqi:  +average(dailyAqi, 150.0).toFixed(2),
    source: "live",
    daily: {
      apparent_temperature_max: daily.apparent_temperature_max || [],
      precipitation_sum:        daily.precipitation_sum        || [],
      daily_max_aqi:            dailyAqi,
    },
  };
}

async function getForecast(payload) {
  if (payload.forecast_override) {
    return { source: "override", ...payload.forecast_override };
  }
  const zone = zoneMap[payload.zone_id];
  try {
    return await fetchLiveForecast(zone);
  } catch {
    const fb = { ...FALLBACK_FORECASTS[payload.zone_id] };
    fb.source = "fallback";
    return fb;
  }
}

// ─── Pricing math (direct port of predict.py) ────────────────────────────────

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function dynamicWeatherScore(forecast, recentTriggerCount) {
  const heatScore    = clamp((forecast.avg_max_temp - 34.0) / 10.0, 0, 1);
  const rainScore    = clamp((forecast.avg_max_rain -  2.0) / 18.0, 0, 1);
  const aqiScore     = clamp((forecast.avg_max_aqi  - 120.0) / 220.0, 0, 1);
  const triggerScore = clamp(recentTriggerCount / 3.0, 0, 1);
  return heatScore * 0.28 + rainScore * 0.24 + aqiScore * 0.34 + triggerScore * 0.14;
}

function normalizedLegacyPremiumSignal(rawTotalPremium) {
  const bounded = Math.min(Math.max(rawTotalPremium, LEGACY_PREMIUM_FLOOR), LEGACY_PREMIUM_CEILING);
  return (bounded - LEGACY_PREMIUM_FLOOR) / (LEGACY_PREMIUM_CEILING - LEGACY_PREMIUM_FLOOR);
}

function pricingScoreForZone(zone, rawTotalPremium, forecast, recentTriggerCount) {
  const rawSignal = normalizedLegacyPremiumSignal(rawTotalPremium);
  return clamp(
    rawSignal * RAW_SIGNAL_WEIGHT
    + (TIER_BASE_SCORE[zone.city_tier]   || TIER_BASE_SCORE.T3)
    + (ZONE_RISK_BASE_SCORE[zone.risk_class] || ZONE_RISK_BASE_SCORE.medium)
    + dynamicWeatherScore(forecast, recentTriggerCount) * WEATHER_DYNAMIC_WEIGHT,
    0, 1
  );
}

function premiumFromPricingScore(score) {
  const span = TARGET_PREMIUM_CEILING - TARGET_PREMIUM_FLOOR;
  return Math.round(TARGET_PREMIUM_FLOOR + clamp(score, 0, 1) * span);
}

/**
 * Replaces XGBoost model.predict().
 * Produces expected_claim_cost in the same range the trained model would.
 * Since this feeds into normalized_legacy_premium_signal (clamped 15–150),
 * the exact value matters less than its order-of-magnitude.
 */
function estimateExpectedClaimCost(baseline, forecast, triggerCount, weekOfYear) {
  const season = getSeason(weekOfYear);
  const heatFactor    = Math.max(0, (forecast.avg_max_temp - 32.0) / 14.0);
  const rainFactor    = Math.max(0, (forecast.avg_max_rain -  1.0) / 22.0);
  const aqiFactor     = Math.max(0, (forecast.avg_max_aqi  - 100.0) / 280.0);
  const triggerFactor = Math.min(1.0, triggerCount * 0.25);
  const seasonMultiplier = [0.92, 1.08, 1.18, 0.98][season] ?? 1.0;
  const weatherRisk = heatFactor * 0.32 + rainFactor * 0.28 + aqiFactor * 0.28 + triggerFactor * 0.12;
  return Math.max(0, baseline * weatherRisk * seasonMultiplier * 0.22);
}

// ─── Explanation builder (mirrors explanation_from_forecast) ──────────────────

function explanationFromForecast(forecast, recentTriggerCount) {
  const { apparent_temperature_max = [], precipitation_sum = [], daily_max_aqi = [] } = forecast.daily || {};

  const candidates = [];

  const aqiDays = daily_max_aqi.filter(v => v >= 280).length;
  if (aqiDays) {
    candidates.push({
      factor: "AQI forecast",
      weight: 0.45 * (aqiDays + 1),
      detail: `${aqiDays} day${aqiDays > 1 ? "s" : ""} predicted AQI above 280`,
    });
  }

  const heavyRainDays = precipitation_sum.filter(v => v >= 15).length;
  if (heavyRainDays) {
    candidates.push({
      factor: "Rain probability",
      weight: 0.38 * (heavyRainDays + 1),
      detail: `${heavyRainDays} day${heavyRainDays > 1 ? "s" : ""} forecast above 15mm rain`,
    });
  }

  const peakTemp = apparent_temperature_max.length
    ? Math.max(...apparent_temperature_max)
    : forecast.avg_max_temp;
  if (peakTemp >= 40) {
    candidates.push({
      factor: "Heat forecast",
      weight: 0.35 * ((peakTemp - 39) / 2),
      detail: `Peak apparent temperature near ${Math.round(peakTemp)}°C`,
    });
  }

  if (recentTriggerCount) {
    candidates.push({
      factor: "Historical triggers",
      weight: 0.27 * recentTriggerCount,
      detail: `${recentTriggerCount} trigger${recentTriggerCount > 1 ? "s" : ""} in the last 4 weeks`,
    });
  }

  if (!candidates.length) {
    return [{ factor: "Seasonal baseline", contribution_pct: 100, detail: "No elevated weather risk factors this week" }];
  }

  const totalWeight = candidates.reduce((s, c) => s + c.weight, 0) || 1;
  const top = candidates
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map(c => ({
      factor: c.factor,
      contribution_pct: Math.round(c.weight / totalWeight * 100),
      detail: c.detail,
    }));

  const diff = 100 - top.reduce((s, t) => s + t.contribution_pct, 0);
  top[0].contribution_pct += diff;
  return top;
}

function buildSummary(riskBand, topFactors) {
  const prefix = { low: "Low risk this week.", medium: "Medium risk this week.", high: "High risk this week." }[riskBand] || "";
  const detail = topFactors.slice(0, 2).map(f => f.detail + ".").join(" ");
  return `${prefix} ${detail}`.trim();
}

// ─── Main entry point (mirrors predict_quote) ─────────────────────────────────

async function predictQuote(payload) {
  const { zone_id, week_start, shift_type } = payload;

  if (!zoneMap[zone_id]) throw new Error(`Unsupported zone_id: ${zone_id}`);
  if (!["lunch", "dinner", "both"].includes(shift_type)) {
    throw new Error("shift_type must be lunch, dinner, or both");
  }

  const zone              = zoneMap[zone_id];
  const lunchBaseline     = parseInt(payload.earnings_baseline_lunch  || zone.avg_lunch_earnings  || 400, 10);
  const dinnerBaseline    = parseInt(payload.earnings_baseline_dinner || zone.avg_dinner_earnings || 650, 10);
  const recentTriggerCount = parseInt(payload.recent_trigger_count || 0, 10);

  const forecast = await getForecast(payload);

  // ISO week number
  const weekDate  = new Date(week_start);
  const startOfYear = new Date(weekDate.getFullYear(), 0, 1);
  const weekOfYear  = Math.ceil(((weekDate - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);

  // Per-shift expected cost (replaces XGBoost model.predict)
  const coveredShifts = shift_type === "both" ? ["lunch", "dinner"] : [shift_type];
  const shiftResults = {};
  for (const shift of coveredShifts) {
    const baseline = shift === "lunch" ? lunchBaseline : dinnerBaseline;
    const expectedClaimCost = estimateExpectedClaimCost(baseline, forecast, recentTriggerCount, weekOfYear);
    const premium = Math.round(expectedClaimCost * (1 + LOADING_FACTOR));
    shiftResults[shift] = { expected_claim_cost: Math.round(expectedClaimCost), premium, baseline };
  }

  const rawTotalPremium = shift_type === "both"
    ? shiftResults.lunch.premium + shiftResults.dinner.premium
    : shiftResults[shift_type].premium;

  const pricingScore = pricingScoreForZone(zone, rawTotalPremium, forecast, recentTriggerCount);
  const totalPremium = premiumFromPricingScore(pricingScore);
  const riskScore    = +pricingScore.toFixed(2);
  const riskBand     = riskScore < 0.34 ? "low" : riskScore < 0.67 ? "medium" : "high";

  const lunchShiftMaxPayout  = Math.round(lunchBaseline  * 0.80);
  const dinnerShiftMaxPayout = Math.round(dinnerBaseline * 0.80);
  const payoutCap = shift_type === "both"
    ? lunchShiftMaxPayout * 6 + dinnerShiftMaxPayout * 6
    : shift_type === "lunch"
    ? lunchShiftMaxPayout  * 6
    : dinnerShiftMaxPayout * 6;

  const topFactors = explanationFromForecast(forecast, recentTriggerCount);

  return {
    risk_score: riskScore,
    risk_band:  riskBand,
    premium:    totalPremium,
    payout_cap: payoutCap,
    lunch_shift_max_payout:  lunchShiftMaxPayout,
    dinner_shift_max_payout: dinnerShiftMaxPayout,
    explanation: {
      top_factors: topFactors,
      summary:     buildSummary(riskBand, topFactors),
    },
  };
}

module.exports = { predictQuote };
