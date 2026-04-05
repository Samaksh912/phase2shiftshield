const express = require("express");
const { authMiddleware } = require("./middleware/auth");
const { buildQuotesRouter } = require("./routes/quotes");
const { buildClaimsRouter } = require("./routes/claims");
const { buildWalletRouter } = require("./routes/wallet");
const { buildPoliciesRouter } = require("./routes/policies");
const { buildDashboardRouter } = require("./routes/dashboard");
const { buildNotificationsRouter } = require("./routes/notifications");
const { buildAdminRouter } = require("./routes/admin");
const { buildCitiesRouter } = require("./routes/cities");
const { buildAuthRouter } = require("./routes/auth");
const { QuoteService } = require("./services/quote-service");
const { MLClient } = require("./services/ml-client");
const { WeatherService } = require("./services/weather-service");
const { WalletService } = require("./services/wallet-service");
const { ClaimsEngine } = require("./services/claims-engine");
const { ClaimsReadService } = require("./services/claims-read-service");
const { AdminService } = require("./services/admin-service");
const { PolicyService } = require("./services/policy-service");
const { DashboardService } = require("./services/dashboard-service");
const { NotificationService } = require("./services/notification-service");
const { CitiesService } = require("./services/cities-service");
const { AuthService } = require("./services/auth-service");
const { TwilioVerificationService } = require("./services/verification-service");
const { createDataStore } = require("./utils/storage");
const { getConfig } = require("./utils/config");

function buildCorsMiddleware(config) {
  const allowedOrigins = new Set(config.allowedOrigins || []);
  const allowAnyOrigin = allowedOrigins.size === 0;
  const allowHeaders = "Origin, X-Requested-With, Content-Type, Accept, Authorization";
  const allowMethods = "GET,POST,PUT,PATCH,DELETE,OPTIONS";

  return (req, res, next) => {
    const origin = req.headers.origin;
    const isLocalhost = origin && (
      origin.startsWith("http://localhost:") ||
      origin.startsWith("http://127.0.0.1:")
    );
    const originAllowed = !origin || allowAnyOrigin || allowedOrigins.has(origin) || isLocalhost;

    if (origin && originAllowed) {
      res.setHeader("Access-Control-Allow-Origin", allowAnyOrigin ? "*" : origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Headers", allowHeaders);
      res.setHeader("Access-Control-Allow-Methods", allowMethods);
    }

    if (req.method === "OPTIONS") {
      if (!originAllowed) {
        return res.status(403).json({
          error: "cors_not_allowed",
          message: "Origin is not allowed"
        });
      }

      return res.status(204).end();
    }

    if (origin && !originAllowed) {
      return res.status(403).json({
        error: "cors_not_allowed",
        message: "Origin is not allowed"
      });
    }

    return next();
  };
}

function buildApp(overrides = {}) {
  const config = overrides.config || getConfig();
  const app = express();
  const dataStore = overrides.dataStore || createDataStore(config);
  const mlClient = overrides.mlClient || new MLClient(config);
  const weatherService = overrides.weatherService || new WeatherService(config);
  const walletService = overrides.walletService || new WalletService({ dataStore });
  const notificationService =
    overrides.notificationService || new NotificationService({ dataStore });
  const quoteService =
    overrides.quoteService || new QuoteService({ dataStore, mlClient, weatherService });
  const claimsEngine =
    overrides.claimsEngine || new ClaimsEngine({ dataStore, walletService, notificationService });
  const claimsReadService =
    overrides.claimsReadService || new ClaimsReadService({ dataStore });
  const adminService =
    overrides.adminService || new AdminService({ dataStore, claimsEngine });
  const policyService =
    overrides.policyService || new PolicyService({ dataStore, walletService, notificationService });
  const dashboardService =
    overrides.dashboardService || new DashboardService({ dataStore, weatherService });
  const citiesService =
    overrides.citiesService || new CitiesService({ dataStore });
  const verificationService =
    overrides.verificationService || new TwilioVerificationService();
  const authService =
    overrides.authService || new AuthService({ dataStore, verificationService });

  app.use(buildCorsMiddleware(config));
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "backend"
    });
  });

  app.use("/api/auth", buildAuthRouter({ authService }));
  app.use("/api/cities", buildCitiesRouter({ citiesService }));

  // Public quote preview — no auth required (used by signup flow before account creation)
  app.post("/api/quotes/preview", async (req, res, next) => {
    try {
      const response = await quoteService.previewQuote({
        zoneId: req.body?.zone_id,
        shiftsCovered: req.body?.shifts_covered,
        weekStart: req.body?.week_start,
      });
      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  });

  app.use("/api/quotes", authMiddleware(), buildQuotesRouter({ quoteService }));
  app.use("/api/policies", authMiddleware(), buildPoliciesRouter({ policyService }));
  app.use("/api/claims", authMiddleware(), buildClaimsRouter({ claimsReadService }));
  app.use("/api/wallet", authMiddleware(), buildWalletRouter({ dataStore, walletService, notificationService }));
  app.use("/api/dashboard", authMiddleware(), buildDashboardRouter({ dashboardService }));
  app.use("/api/notifications", authMiddleware(), buildNotificationsRouter({ notificationService }));
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
