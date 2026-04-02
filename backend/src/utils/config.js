const path = require("path");

const backendRoot = path.resolve(__dirname, "..", "..");

function getConfig() {
  return {
    backendRoot,
    host: process.env.HOST || "127.0.0.1",
    port: Number(process.env.PORT || 3000),
    nodeEnv: process.env.NODE_ENV || "development",
    jwtSecret: process.env.JWT_SECRET || "shiftshield-dev-secret",
    mlServiceUrl: process.env.ML_SERVICE_URL || "http://127.0.0.1:8000",
    openMeteoWeatherUrl:
      process.env.OPEN_METEO_WEATHER_URL || "https://api.open-meteo.com/v1/forecast",
    openMeteoAqiUrl:
      process.env.OPEN_METEO_AQI_URL || "https://air-quality-api.open-meteo.com/v1/air-quality",
    supabaseUrl: process.env.SUPABASE_URL || "",
    supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY || "",
    localStorePath: path.join(backendRoot, "data", "local-db.json"),
    citiesSeedPath: path.join(backendRoot, "seed", "cities.json"),
    zonesSeedPath: path.join(backendRoot, "seed", "zones.json"),
    thresholdsSeedPath: path.join(backendRoot, "seed", "thresholds.json"),
    ridersSeedPath: path.join(backendRoot, "seed", "mock-riders.json")
  };
}

module.exports = {
  getConfig
};
