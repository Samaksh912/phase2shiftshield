const { getConfig } = require("../utils/config");

const FALLBACK_FORECASTS = {
  koramangala: {
    avg_max_temp: 40,
    avg_max_rain: 8,
    avg_max_aqi: 214,
    daily: {
      apparent_temperature_max: [38, 40, 39, 41, 40, 39, 38],
      precipitation_sum: [0, 4, 16, 8, 0, 6, 2],
      daily_max_aqi: [172, 214, 238, 286, 224, 205, 192],
      weather_code: [1, 2, 61, 63, 2, 61, 3]
    }
  },
  indiranagar: {
    avg_max_temp: 38,
    avg_max_rain: 5,
    avg_max_aqi: 170,
    daily: {
      apparent_temperature_max: [36, 37, 39, 39, 38, 37, 36],
      precipitation_sum: [0, 2, 10, 5, 0, 6, 1],
      daily_max_aqi: [155, 172, 182, 188, 179, 168, 160],
      weather_code: [1, 2, 61, 2, 2, 61, 1]
    }
  },
  hsr_layout: {
    avg_max_temp: 39,
    avg_max_rain: 7,
    avg_max_aqi: 210,
    daily: {
      apparent_temperature_max: [38, 39, 41, 40, 39, 38, 37],
      precipitation_sum: [1, 4, 14, 10, 2, 8, 3],
      daily_max_aqi: [182, 205, 234, 242, 228, 216, 201],
      weather_code: [2, 3, 63, 63, 3, 61, 2]
    }
  },
  whitefield: {
    avg_max_temp: 41,
    avg_max_rain: 9,
    avg_max_aqi: 244,
    daily: {
      apparent_temperature_max: [40, 41, 42, 43, 42, 40, 39],
      precipitation_sum: [2, 6, 18, 12, 4, 11, 5],
      daily_max_aqi: [220, 248, 276, 292, 255, 241, 230],
      weather_code: [2, 3, 63, 65, 61, 61, 3]
    }
  },
  electronic_city: {
    avg_max_temp: 42,
    avg_max_rain: 10,
    avg_max_aqi: 258,
    daily: {
      apparent_temperature_max: [41, 42, 43, 44, 42, 41, 40],
      precipitation_sum: [2, 7, 20, 16, 5, 12, 6],
      daily_max_aqi: [238, 262, 284, 301, 276, 254, 236],
      weather_code: [2, 61, 63, 65, 63, 61, 3]
    }
  }
};

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
    const fallback = FALLBACK_FORECASTS[zone.id] || FALLBACK_FORECASTS.koramangala;
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
