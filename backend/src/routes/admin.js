const express = require("express");

function buildAdminRouter({ adminService }) {
  const router = express.Router();

  router.post("/simulate-trigger", async (req, res, next) => {
    try {
      const response = await adminService.simulateTrigger(req.body);
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = {
  buildAdminRouter
};
