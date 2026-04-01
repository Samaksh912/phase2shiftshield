const express = require("express");

function buildClaimsRouter({ claimsReadService }) {
  const router = express.Router();

  router.get("/", async (req, res, next) => {
    try {
      const response = await claimsReadService.listClaimsForRider(req.user.rider_id);
      res.json(response);
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id", async (req, res, next) => {
    try {
      const response = await claimsReadService.getClaimForRider(req.params.id, req.user.rider_id);
      res.json(response);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = {
  buildClaimsRouter
};
