const express = require("express");
const { safelyCreateNotification } = require("../utils/notifications");

function formatTransaction(transaction) {
  return {
    id: transaction.id,
    type: transaction.type,
    amount: transaction.amount,
    description: transaction.description,
    created_at: transaction.created_at
  };
}

async function notifyWalletEvent(notificationService, { riderId, type, title, message }) {
  await safelyCreateNotification(notificationService, {
    riderId,
    type,
    title,
    message
  });
}

function buildWalletRouter({ dataStore, walletService, notificationService }) {
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
        transactions: transactions.map(formatTransaction),
        pagination: {
          page: 1,
          total_pages: 1,
          has_more: false
        }
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
      return res.json({ transactions: transactions.map(formatTransaction) });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/topup", async (req, res, next) => {
    try {
      const amount = req.body?.amount;
      if (!Number.isSafeInteger(amount) || amount <= 0) {
        return res.status(400).json({
          error: "validation_error",
          message: "amount must be a safe positive integer"
        });
      }

      const wallet = await dataStore.getWalletByRiderId(req.user.rider_id);
      if (!wallet) {
        return res.status(404).json({
          error: "not_found",
          message: "Wallet not found"
        });
      }

      const result = await walletService.creditWallet(
        wallet.id,
        amount,
        "credit_topup",
        req.body?.reference_id || null,
        req.body?.description || "Manual wallet top-up",
        "wallet"
      );

      await notifyWalletEvent(notificationService, {
        riderId: req.user.rider_id,
        type: "wallet_credited",
        title: "Wallet topped up",
        message: `₹${amount} has been added to your wallet.`
      });

      return res.status(200).json({
        wallet: {
          id: result.wallet.id,
          balance: result.wallet.balance,
          currency: "INR"
        },
        transaction: formatTransaction(result.transaction)
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post("/withdraw", async (req, res, next) => {
    try {
      const amount = req.body?.amount;
      if (!Number.isSafeInteger(amount) || amount <= 0) {
        return res.status(400).json({
          error: "validation_error",
          message: "amount must be a safe positive integer"
        });
      }

      const wallet = await dataStore.getWalletByRiderId(req.user.rider_id);
      if (!wallet) {
        return res.status(404).json({
          error: "not_found",
          message: "Wallet not found"
        });
      }

      let result;
      try {
        result = await walletService.debitWallet(
          wallet.id,
          amount,
          "debit_withdrawal",
          req.body?.reference_id || null,
          req.body?.description || "Wallet withdrawal requested",
          "wallet"
        );
      } catch (error) {
        if (error.code === "insufficient_balance") {
          return res.status(400).json({
            error: "insufficient_balance",
            message: error.message
          });
        }
        throw error;
      }

      await notifyWalletEvent(notificationService, {
        riderId: req.user.rider_id,
        type: "wallet_debited",
        title: "Withdrawal requested",
        message: `Your withdrawal of ₹${amount} is being processed.`
      });

      return res.status(200).json({
        wallet: {
          id: result.wallet.id,
          balance: result.wallet.balance,
          currency: "INR"
        },
        transaction: formatTransaction(result.transaction),
        withdrawal_status: "processing",
        expected_completion: "24-48 hours"
      });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = {
  buildWalletRouter
};
