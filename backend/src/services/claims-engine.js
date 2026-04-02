const { getCurrentISTDate } = require("../utils/time");
const { safelyCreateNotification } = require("../utils/notifications");
const { runFraudChecks } = require("./fraud-checker");

class ClaimsEngine {
  constructor({ dataStore, walletService, notificationService = null, nowProvider = () => new Date() }) {
    this.dataStore = dataStore;
    this.walletService = walletService;
    this.notificationService = notificationService;
    this.nowProvider = nowProvider;
  }

  async notifyClaimOutcome({ riderId, claimStatus, payoutAmount, shiftType }) {
    if (claimStatus === "paid") {
      await safelyCreateNotification(this.notificationService, {
        riderId,
        type: "claim_paid",
        title: "Claim paid",
        message: `₹${payoutAmount} has been credited for your ${shiftType} shift claim.`
      });
      return;
    }

    if (claimStatus === "under_review") {
      await safelyCreateNotification(this.notificationService, {
        riderId,
        type: "claim_under_review",
        title: "Payout verification in progress",
        message: "Your claim has been created and payout verification is in progress."
      });
    }
  }

  async processClaimsForTrigger(triggerEvent) {
    const now = this.nowProvider();
    const claimDate = getCurrentISTDate(now);
    const shiftType = triggerEvent.shift_type;
    const policies = await this.dataStore.listActivePoliciesByZoneAndShift(
      triggerEvent.zone_id,
      shiftType,
      claimDate
    );

    const results = [];

    for (const policy of policies) {
      const rider = policy.rider;
      const existingClaim = await this.dataStore.getClaimByUnique(policy.id, shiftType, claimDate);
      const platformRider = await this.dataStore.getMockPlatformRiderByPhone(rider.phone);
      const fraudResult = runFraudChecks({
        rider,
        policy,
        triggerEvent,
        shiftType,
        claimDate,
        existingClaim,
        platformRider,
        now
      });

      if (fraudResult.hardFail) {
        results.push({ rider_id: rider.id, outcome: "skipped", reason: "hard_fail", checks: fraudResult.checks });
        continue;
      }

      const baseline = shiftType === "lunch" ? rider.lunch_baseline : rider.dinner_baseline;
      const payoutAmount = Math.round((baseline * triggerEvent.payout_percent) / 100);
      const claimStatus = fraudResult.softFail ? "under_review" : "paid";

      const claim = await this.dataStore.createClaim({
        rider_id: rider.id,
        policy_id: policy.id,
        trigger_event_id: triggerEvent.id,
        shift_type: shiftType,
        claim_date: claimDate,
        baseline_used: baseline,
        payout_percent: triggerEvent.payout_percent,
        payout_amount: payoutAmount,
        status: claimStatus,
        fraud_flag: fraudResult.softFail
      });

      let walletTransaction = null;

      if (claimStatus === "paid") {
        try {
          const wallet = await this.dataStore.getWalletByRiderId(rider.id);
          if (!wallet) {
            throw new Error("Wallet not found for rider");
          }

          const creditResult = await this.walletService.creditWallet(
            wallet.id,
            payoutAmount,
            "credit_payout",
            claim.id,
            `${triggerEvent.trigger_type.toUpperCase()} trigger — ${shiftType} shift ${claimDate}`
          );
          walletTransaction = creditResult.transaction;
        } catch (error) {
          await this.dataStore.deleteClaimById(claim.id);
          throw error;
        }
      }

      await this.notifyClaimOutcome({
        riderId: rider.id,
        claimStatus,
        payoutAmount,
        shiftType
      });

      results.push({
        rider_id: rider.id,
        outcome: claimStatus,
        claim,
        wallet_transaction: walletTransaction,
        checks: fraudResult.checks
      });
    }

    return {
      claim_date: claimDate,
      affected_policies_count: policies.length,
      claims_paid_count: results.filter((result) => result.outcome === "paid").length,
      claims_under_review_count: results.filter((result) => result.outcome === "under_review").length,
      total_wallet_credited: results
        .filter((result) => result.wallet_transaction)
        .reduce((sum, result) => sum + result.wallet_transaction.amount, 0),
      results
    };
  }
}

module.exports = {
  ClaimsEngine
};
