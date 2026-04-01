const express = require("express");

function buildWalletRouter({ dataStore }) {
  const router = express.Router();

  router.get("/", async (req, res, next) => {
    try {
      const wallet = await dataStore.getWalletByRiderId(req.user.rider_id);
      if (!wallet) {
        return res.status(404).json({
          error: "not_found",
          message: "Wallet not found"
        });
      }

      const transactions = await dataStore.listWalletTransactionsByWalletId(wallet.id);
      return res.json({
        wallet: {
          id: wallet.id,
          balance: wallet.balance,
          currency: "INR"
        },
        transactions
      });
    } catch (error) {
      return next(error);
    }
  });

  router.get("/transactions", async (req, res, next) => {
    try {
      const wallet = await dataStore.getWalletByRiderId(req.user.rider_id);
      if (!wallet) {
        return res.status(404).json({
          error: "not_found",
          message: "Wallet not found"
        });
      }

      const transactions = await dataStore.listWalletTransactionsByWalletId(wallet.id);
      return res.json({ transactions });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = {
  buildWalletRouter
};
