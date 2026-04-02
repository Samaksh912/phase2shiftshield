const express = require("express");

function buildCitiesRouter({ citiesService }) {
  const router = express.Router();

  router.get("/", async (_req, res, next) => {
    try {
      const response = await citiesService.listCities();
      return res.json(response);
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = {
  buildCitiesRouter
};
