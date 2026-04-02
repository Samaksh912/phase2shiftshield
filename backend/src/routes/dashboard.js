const express = require("express");

function buildDashboardRouter({ dashboardService }) {
  const router = express.Router();

  router.get("/", async (req, res, next) => {
    try {
      const response = await dashboardService.getDashboard(req.user.rider_id);
      return res.json(response);
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = {
  buildDashboardRouter
};
