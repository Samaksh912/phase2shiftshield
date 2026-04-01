const express = require("express");

function buildAdminRouter({ adminService, policyService }) {
  const router = express.Router();

  router.post("/simulate-trigger", async (req, res, next) => {
    try {
      const response = await adminService.simulateTrigger(req.body);
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  });

  router.post("/policies/run-lifecycle", async (_req, res, next) => {
    try {
      const response = await policyService.runLifecycle();
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = {
  buildAdminRouter
};
