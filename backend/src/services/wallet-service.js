const ALLOWED_TYPES = new Set([
  "credit_payout",
  "debit_premium",
  "credit_topup",
  "debit_withdrawal"
]);

class WalletService {
  constructor({ dataStore }) {
    this.dataStore = dataStore;
  }

  async creditWallet(walletId, amount, type, referenceId, description, referenceType = "claim") {
    this.validateRequest(amount, type, true);
    return this.dataStore.applyWalletTransaction({
      walletId,
      delta: amount,
      type,
      referenceType,
      referenceId,
      description
    });
  }

  async debitWallet(walletId, amount, type, referenceId, description, referenceType = "policy") {
    this.validateRequest(amount, type, false);
    return this.dataStore.applyWalletTransaction({
      walletId,
      delta: -amount,
      type,
      referenceType,
      referenceId,
      description
    });
  }

  validateRequest(amount, type, isCredit) {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new Error("Wallet amount must be a positive integer");
    }
    if (!ALLOWED_TYPES.has(type)) {
      throw new Error("Unsupported wallet transaction type");
    }
    if (isCredit && !type.startsWith("credit_")) {
      throw new Error("Credit wallet calls require a credit_* type");
    }
    if (!isCredit && !type.startsWith("debit_")) {
      throw new Error("Debit wallet calls require a debit_* type");
    }
  }
}

module.exports = {
  WalletService
};
