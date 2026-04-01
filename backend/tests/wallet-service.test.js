const test = require("node:test");
const assert = require("node:assert/strict");
const { WalletService } = require("../src/services/wallet-service");
const { createTestDataStore } = require("./test-helpers");

test("WalletService credits and debits wallet while preserving non-negative balance", async () => {
  const { dataStore } = createTestDataStore();
  const walletService = new WalletService({ dataStore });
  const wallet = await dataStore.getWalletByRiderId("11111111-1111-4111-8111-111111111111");

  const credit = await walletService.creditWallet(
    wallet.id,
    120,
    "credit_topup",
    "topup-demo",
    "Manual top-up (demo)",
    "wallet"
  );
  assert.equal(credit.wallet.balance, 476);
  assert.equal(credit.transaction.amount, 120);

  const debit = await walletService.debitWallet(
    wallet.id,
    76,
    "debit_withdrawal",
    "withdraw-demo",
    "Withdrawal to UPI (processing)",
    "wallet"
  );
  assert.equal(debit.wallet.balance, 400);
  assert.equal(debit.transaction.amount, -76);

  await assert.rejects(
    () =>
      walletService.debitWallet(
        wallet.id,
        1000,
        "debit_withdrawal",
        "withdraw-demo-2",
        "Withdrawal to UPI (processing)",
        "wallet"
      ),
    /Insufficient wallet balance/
  );
});
