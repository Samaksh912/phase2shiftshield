const express = require("express");

function buildNotificationsRouter({ notificationService }) {
  const router = express.Router();

  router.get("/", async (req, res, next) => {
    try {
      const response = await notificationService.listNotificationsForRider(req.user.rider_id, req.query);
      return res.json(response);
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = {
  buildNotificationsRouter
};
