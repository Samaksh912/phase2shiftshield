const express = require("express");

function buildPoliciesRouter({ policyService }) {
  const router = express.Router();

  router.post("/create", async (req, res, next) => {
    try {
      const response = await policyService.createPolicy({
        riderId: req.user.rider_id,
        quoteId: req.body?.quote_id,
        paymentMethod: req.body?.payment_method
      });
      return res.status(201).json(response);
    } catch (error) {
      if (error.code === "insufficient_balance") {
        return res.status(400).json({
          error: "insufficient_balance",
          wallet_balance: error.wallet_balance,
          premium_required: error.premium_required,
          shortfall: error.shortfall,
          message: error.message
        });
      }
      return next(error);
    }
  });

  router.get("/current", async (req, res, next) => {
    try {
      const response = await policyService.getCurrentPolicy(req.user.rider_id);
      return res.json(response);
    } catch (error) {
      return next(error);
    }
  });

  router.get("/history", async (req, res, next) => {
    try {
      const response = await policyService.listPolicyHistory(req.user.rider_id, req.query);
      return res.json(response);
    } catch (error) {
      return next(error);
    }
  });

  router.post("/:id/renew", async (req, res, next) => {
    try {
      const response = await policyService.renewPolicy({
        riderId: req.user.rider_id,
        sourcePolicyId: req.params.id,
        quoteId: req.body?.quote_id,
        paymentMethod: req.body?.payment_method
      });
      return res.status(201).json(response);
    } catch (error) {
      if (error.code === "insufficient_balance") {
        return res.status(400).json({
          error: "insufficient_balance",
          wallet_balance: error.wallet_balance,
          premium_required: error.premium_required,
          shortfall: error.shortfall,
          message: error.message
        });
      }
      return next(error);
    }
  });

  router.get("/:id", async (req, res, next) => {
    try {
      const response = await policyService.getPolicyDetail(req.user.rider_id, req.params.id);
      return res.json(response);
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = {
  buildPoliciesRouter
};
