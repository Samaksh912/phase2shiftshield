const express = require("express");
const { authMiddleware } = require("./middleware/auth");
const { buildQuotesRouter } = require("./routes/quotes");
const { buildClaimsRouter } = require("./routes/claims");
const { buildWalletRouter } = require("./routes/wallet");
const { buildAdminRouter } = require("./routes/admin");
const { QuoteService } = require("./services/quote-service");
const { MLClient } = require("./services/ml-client");
const { WeatherService } = require("./services/weather-service");
const { WalletService } = require("./services/wallet-service");
const { ClaimsEngine } = require("./services/claims-engine");
const { ClaimsReadService } = require("./services/claims-read-service");
const { AdminService } = require("./services/admin-service");
const { createDataStore } = require("./utils/storage");

function buildApp(overrides = {}) {
  const app = express();
  const dataStore = overrides.dataStore || createDataStore();
  const mlClient = overrides.mlClient || new MLClient();
  const weatherService = overrides.weatherService || new WeatherService();
  const walletService = overrides.walletService || new WalletService({ dataStore });
  const quoteService =
    overrides.quoteService || new QuoteService({ dataStore, mlClient, weatherService });
  const claimsEngine =
    overrides.claimsEngine || new ClaimsEngine({ dataStore, walletService });
  const claimsReadService =
    overrides.claimsReadService || new ClaimsReadService({ dataStore });
  const adminService =
    overrides.adminService || new AdminService({ dataStore, claimsEngine });

  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "backend"
    });
  });

  app.use("/api/quotes", authMiddleware(), buildQuotesRouter({ quoteService }));
  app.use("/api/claims", authMiddleware(), buildClaimsRouter({ claimsReadService }));
  app.use("/api/wallet", authMiddleware(), buildWalletRouter({ dataStore }));
  app.use("/api/admin", buildAdminRouter({ adminService }));

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
