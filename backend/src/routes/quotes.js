const express = require("express");

function buildQuotesRouter({ quoteService }) {
  const router = express.Router();

  router.post("/generate", async (req, res, next) => {
    try {
      const response = await quoteService.generateQuote({
        riderId: req.user.rider_id,
        weekStart: req.body.week_start
      });
      return res.status(200).json(response);
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = {
  buildQuotesRouter
};
