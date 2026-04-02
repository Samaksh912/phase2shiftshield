const fs = require("fs");
const path = require("path");
const { getConfig } = require("../utils/config");

const CITIES_SEED_PATH = path.resolve(__dirname, "../../seed/cities.json");
const ZONES_SEED_PATH = path.resolve(__dirname, "../../seed/zones.json");

function loadCities() {
  const cities = JSON.parse(fs.readFileSync(CITIES_SEED_PATH, "utf8"));
  return new Map(cities.map((city) => [city.id, city]));
}

function loadZones() {
  const citiesById = loadCities();
  const zones = JSON.parse(fs.readFileSync(ZONES_SEED_PATH, "utf8"));

  return zones.map((zone) => {
    const city = citiesById.get(zone.city_id);
    if (!city) {
      throw new Error(`Zone ${zone.id} references unknown city_id ${zone.city_id}`);
    }

    return {
      ...zone,
      city: {
        id: city.id,
        name: city.name,
        state: city.state,
        city_tier: city.city_tier
      },
      city_tier: zone.city_tier || city.city_tier
    };
  });
}

function buildFallbackForecast(zone) {
  const cityTier = zone.city_tier || zone.tier || "T1";
  const tierTempBase = { T1: 39.5, T2: 37.5, T3: 35.5 }[cityTier] || 38.0;
  const riskRainBase = { low: 4, medium: 7, high: 10 }[zone.risk_class] || 6;
  const riskAqiBase = { low: 165, medium: 220, high: 275 }[zone.risk_class] || 200;
  const temperature = Number((tierTempBase + (zone.avg_dinner_earnings - 500) / 120).toFixed(1));
  const rain = Number((riskRainBase + zone.avg_lunch_earnings / 180).toFixed(1));
  const aqi = Number((riskAqiBase + (cityTier === "T1" ? 18 : cityTier === "T2" ? 8 : 0)).toFixed(1));

  return {
    avg_max_temp: temperature,
    avg_max_rain: rain,
    avg_max_aqi: aqi,
    daily: {
      apparent_temperature_max: [
        Math.round(temperature - 2),
        Math.round(temperature - 1),
        Math.round(temperature),
        Math.round(temperature + 1),
        Math.round(temperature),
        Math.round(temperature - 1),
        Math.round(temperature - 2)
      ],
      precipitation_sum: [
        Math.max(0, Math.round(rain - 4)),
        Math.max(0, Math.round(rain - 2)),
        Math.round(rain + 3),
        Math.round(rain + 1),
        Math.max(0, Math.round(rain - 3)),
        Math.round(rain),
        Math.max(0, Math.round(rain - 2))
      ],
      daily_max_aqi: [
        Math.round(aqi - 28),
        Math.round(aqi - 8),
        Math.round(aqi + 12),
        Math.round(aqi + 22),
        Math.round(aqi + 6),
        Math.round(aqi - 10),
        Math.round(aqi - 18)
      ],
      weather_code: [1, 2, 61, 63, 2, 61, 3]
    }
  };
}

const FALLBACK_FORECASTS = Object.fromEntries(loadZones().map((zone) => [zone.id, buildFallbackForecast(zone)]));

function average(values, fallback) {
  if (!Array.isArray(values) || values.length === 0) {
    return fallback;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getDailyMaxAQI(hourlyAqi) {
  const maxValues = [];
  for (let index = 0; index < 7; index += 1) {
    const slice = hourlyAqi.slice(index * 24, (index + 1) * 24);
    maxValues.push(slice.length ? Math.max(...slice) : 50);
  }
  return maxValues;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Open-Meteo request failed (${response.status}): ${text}`);
  }
  return response.json();
}

class WeatherService {
  constructor(config = getConfig()) {
    this.config = config;
  }

  async fetchWeeklyForecastSummary(zone) {
    const fallback = FALLBACK_FORECASTS[zone.id] || buildFallbackForecast(zone);
    const weatherUrl =
      `${this.config.openMeteoWeatherUrl}?latitude=${zone.lat}&longitude=${zone.lng}` +
      "&daily=temperature_2m_max,apparent_temperature_max,precipitation_sum,weather_code" +
      "&timezone=Asia/Kolkata&forecast_days=7";
    const aqiUrl =
      `${this.config.openMeteoAqiUrl}?latitude=${zone.lat}&longitude=${zone.lng}` +
      "&hourly=us_aqi&timezone=Asia/Kolkata&forecast_days=7";

    try {
      const [weather, aqi] = await Promise.all([fetchJson(weatherUrl), fetchJson(aqiUrl)]);
      const daily = weather.daily || {};
      const dailyMaxAqi = getDailyMaxAQI(aqi.hourly?.us_aqi || []);

      return {
        source: "live",
        avg_max_temp: Number(average(daily.apparent_temperature_max, fallback.avg_max_temp).toFixed(2)),
        avg_max_rain: Number(average(daily.precipitation_sum, fallback.avg_max_rain).toFixed(2)),
        avg_max_aqi: Number(average(dailyMaxAqi, fallback.avg_max_aqi).toFixed(2)),
        daily: {
          apparent_temperature_max: daily.apparent_temperature_max || fallback.daily.apparent_temperature_max,
          precipitation_sum: daily.precipitation_sum || fallback.daily.precipitation_sum,
          daily_max_aqi: dailyMaxAqi.length ? dailyMaxAqi : fallback.daily.daily_max_aqi,
          weather_code: daily.weather_code || fallback.daily.weather_code
        }
      };
    } catch (error) {
      return {
        ...fallback,
        source: "fallback",
        fallback_reason: error.message
      };
    }
  }
}

module.exports = {
  WeatherService
};
