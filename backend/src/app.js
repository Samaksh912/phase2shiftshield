const express = require("express");
const { authMiddleware } = require("./middleware/auth");
const { buildQuotesRouter } = require("./routes/quotes");
const { QuoteService } = require("./services/quote-service");
const { MLClient } = require("./services/ml-client");
const { WeatherService } = require("./services/weather-service");
const { createDataStore } = require("./utils/storage");

function buildApp(overrides = {}) {
  const app = express();
  const dataStore = overrides.dataStore || createDataStore();
  const mlClient = overrides.mlClient || new MLClient();
  const weatherService = overrides.weatherService || new WeatherService();
  const quoteService =
    overrides.quoteService || new QuoteService({ dataStore, mlClient, weatherService });

  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "backend"
    });
  });

  app.use("/api/quotes", authMiddleware(), buildQuotesRouter({ quoteService }));

  app.use((error, _req, res, _next) => {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      error: error.code || "server_error",
      message: error.message || "Unexpected server error"
    });
  });

  return app;
}

module.exports = {
  buildApp
};
