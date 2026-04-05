const express = require("express");
const { authMiddleware } = require("../middleware/auth");

function buildAuthRouter({ authService }) {
  const router = express.Router();

  router.post("/request-otp", async (req, res, next) => {
    try {
      const response = await authService.requestSignupOtp(req.body || {});
      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  });

  router.post("/verify-otp", async (req, res, next) => {
    try {
      const response = await authService.verifySignupOtp(req.body || {});
      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  });

  router.post("/request-login-otp", async (req, res, next) => {
    try {
      const response = await authService.requestLoginOtp(req.body || {});
      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  });

  router.post("/verify-login-otp", async (req, res, next) => {
    try {
      const response = await authService.verifyLoginOtp(req.body || {});
      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  });

  router.post("/signup", async (req, res, next) => {
    try {
      const response = await authService.signup(req.body || {});
      return res.status(201).json(response);
    } catch (error) {
      return next(error);
    }
  });

  router.post("/login", async (req, res, next) => {
    try {
      const response = await authService.login(req.body || {});
      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  });

  router.delete("/account", authMiddleware(), async (req, res, next) => {
    try {
      const response = await authService.deleteAccount({ riderId: req.user.rider_id });
      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  });

  router.get("/me", authMiddleware(), async (req, res, next) => {
    try {
      const response = await authService.getSessionProfile({
        riderId: req.user.rider_id,
        phone: req.user.phone
      });
      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = {
  buildAuthRouter
};
