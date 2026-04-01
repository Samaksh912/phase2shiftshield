const express = require("express");
const { authMiddleware } = require("./middleware/auth");
const { buildQuotesRouter } = require("./routes/quotes");
const { buildClaimsRouter } = require("./routes/claims");
const { buildWalletRouter } = require("./routes/wallet");
const { buildPoliciesRouter } = require("./routes/policies");
const { buildAdminRouter } = require("./routes/admin");
const { QuoteService } = require("./services/quote-service");
const { MLClient } = require("./services/ml-client");
const { WeatherService } = require("./services/weather-service");
const { WalletService } = require("./services/wallet-service");
const { ClaimsEngine } = require("./services/claims-engine");
const { ClaimsReadService } = require("./services/claims-read-service");
const { AdminService } = require("./services/admin-service");
const { PolicyService } = require("./services/policy-service");
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
  const policyService =
    overrides.policyService || new PolicyService({ dataStore, walletService });

  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "backend"
    });
  });

  app.use("/api/quotes", authMiddleware(), buildQuotesRouter({ quoteService }));
  app.use("/api/policies", authMiddleware(), buildPoliciesRouter({ policyService }));
  app.use("/api/claims", authMiddleware(), buildClaimsRouter({ claimsReadService }));
  app.use("/api/wallet", authMiddleware(), buildWalletRouter({ dataStore, walletService }));
  app.use("/api/admin", buildAdminRouter({ adminService, policyService }));

  app.use((error, _req, res, _next) => {
    if (error?.type === "entity.parse.failed" || error instanceof SyntaxError) {
      return res.status(400).json({
        error: "validation_error",
        message: "Malformed JSON request body"
      });
    }

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
