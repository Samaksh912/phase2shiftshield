const crypto = require("crypto");
const { getCurrentISTDate, getPurchaseDeadline, getWeekEnd, isBeforeDeadline } = require("../utils/time");
const { safelyCreateNotification } = require("../utils/notifications");
const { getUnderwritingState, isEligibleForPurchase } = require("../utils/underwriting");

function buildError({ message, code, statusCode }) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

class PolicyService {
  constructor({ dataStore, walletService, notificationService = null, nowProvider = () => new Date() }) {
    this.dataStore = dataStore;
    this.walletService = walletService;
    this.notificationService = notificationService;
    this.nowProvider = nowProvider;
  }

  formatPolicy(policy) {
    return {
      id: policy.id,
      quote_id: policy.quote_id,
      week_start: policy.week_start,
      week_end: policy.week_end,
      shifts_covered: policy.shifts_covered,
      premium_paid: policy.premium_paid,
      payout_cap: policy.payout_cap,
      status: policy.status,
      created_at: policy.created_at
    };
  }

  parsePagination(query = {}) {
    const limit = query.limit === undefined ? 20 : Number(query.limit);
    const offset = query.offset === undefined ? 0 : Number(query.offset);

    if (!Number.isSafeInteger(limit) || limit <= 0 || limit > 100) {
      throw buildError({
        message: "limit must be a safe positive integer between 1 and 100",
        code: "validation_error",
        statusCode: 400
      });
    }

    if (!Number.isSafeInteger(offset) || offset < 0) {
      throw buildError({
        message: "offset must be a safe non-negative integer",
        code: "validation_error",
        statusCode: 400
      });
    }

    return { limit, offset };
  }

  async notifyPolicyEvent({ riderId, policy, notificationType }) {
    const isRenewal = notificationType === "policy_renewed";
    await safelyCreateNotification(this.notificationService, {
      riderId,
      type: notificationType,
      title: isRenewal ? "Policy renewed" : "Policy created",
      message: isRenewal
        ? `Your policy has been renewed for ${policy.week_start} to ${policy.week_end}.`
        : `Your policy is confirmed for ${policy.week_start} to ${policy.week_end}.`
    });
  }

  async createPolicy({ riderId, quoteId, paymentMethod, notificationType = "policy_created" }) {
    const now = this.nowProvider();

    if (!quoteId || typeof quoteId !== "string") {
      throw buildError({
        message: "quote_id is required",
        code: "validation_error",
        statusCode: 400
      });
    }

    if (paymentMethod !== "wallet" && paymentMethod !== "direct") {
      throw buildError({
        message: "payment_method must be one of wallet, direct",
        code: "validation_error",
        statusCode: 400
      });
    }

    const rider = await this.dataStore.getRiderById(riderId);
    if (!rider) {
      throw buildError({
        message: "Rider profile not found",
        code: "not_found",
        statusCode: 404
      });
    }

    const quote = await this.dataStore.getQuoteById(quoteId);
    if (!quote || quote.rider_id !== riderId) {
      throw buildError({
        message: "Quote not found",
        code: "not_found",
        statusCode: 404
      });
    }

    const platformRider = await this.dataStore.getMockPlatformRiderByPhone(rider.phone);
    const underwriting = getUnderwritingState(platformRider);

    const purchaseDeadline = getPurchaseDeadline(quote.week_start);
    const effectiveValidUntil = quote.valid_until || purchaseDeadline;
    if (!isBeforeDeadline(effectiveValidUntil, now) || !isBeforeDeadline(purchaseDeadline, now)) {
      throw buildError({
        message: "This quote has expired and can no longer be purchased",
        code: "quote_expired",
        statusCode: 400
      });
    }

    if (!isEligibleForPurchase(underwriting)) {
      const underwritingError = buildError({
        message: underwriting.message,
        code: underwriting.status,
        statusCode: 409
      });
      underwritingError.active_days_last_30 = underwriting.active_days_last_30;
      throw underwritingError;
    }

    const existingPolicy = await this.dataStore.getPolicyByRiderAndWeekStart(riderId, quote.week_start);
    if (existingPolicy) {
      throw buildError({
        message: "A policy already exists for this rider and week",
        code: "policy_exists",
        statusCode: 409
      });
    }

    const activeDisruptionSinceIso = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
    const hasActiveDisruption = await this.dataStore.hasActiveDisruption(rider.zone_id, activeDisruptionSinceIso);
    if (hasActiveDisruption) {
      throw buildError({
        message: "An active disruption event is detected in your zone. Policy purchase is temporarily unavailable.",
        code: "disruption_active",
        statusCode: 409
      });
    }

    const weekEnd = getWeekEnd(quote.week_start);
    const policyId = crypto.randomUUID();
    let walletResponse = null;
    let transactionResponse = null;
    let debitedTransactionId = null;

    if (paymentMethod === "wallet") {
      const wallet = await this.dataStore.getWalletByRiderId(riderId);
      if (!wallet) {
        throw buildError({
          message: "Wallet not found",
          code: "not_found",
          statusCode: 404
        });
      }

      try {
        const debitResult = await this.walletService.debitWallet(
          wallet.id,
          quote.premium,
          "debit_premium",
          policyId,
          `Weekly premium — ${quote.week_start} to ${weekEnd}`,
          "policy"
        );
        walletResponse = {
          id: debitResult.wallet.id,
          balance: debitResult.wallet.balance,
          previous_balance: debitResult.wallet.balance + quote.premium,
          currency: "INR"
        };
        debitedTransactionId = debitResult.transaction.id;
        transactionResponse = {
          id: debitResult.transaction.id,
          type: debitResult.transaction.type,
          amount: debitResult.transaction.amount,
          description: debitResult.transaction.description,
          created_at: debitResult.transaction.created_at
        };
      } catch (error) {
        if (error.code === "insufficient_balance") {
          const shortfall = quote.premium - wallet.balance;
          const insufficientBalanceError = buildError({
            message: `Insufficient wallet balance. Please top up ₹${quote.premium - wallet.balance} or choose direct payment.`,
            code: "insufficient_balance",
            statusCode: 400
          });
          insufficientBalanceError.wallet_balance = wallet.balance;
          insufficientBalanceError.premium_required = quote.premium;
          insufficientBalanceError.shortfall = shortfall;
          throw insufficientBalanceError;
        }
        throw error;
      }
    }

    let policy;
    try {
      policy = await this.dataStore.createPolicy({
        id: policyId,
        rider_id: riderId,
        quote_id: quote.id,
        week_start: quote.week_start,
        week_end: weekEnd,
        shifts_covered: quote.shifts_covered,
        premium_paid: quote.premium,
        payout_cap: quote.payout_cap,
        status: "scheduled"
      });
    } catch (error) {
      if (debitedTransactionId) {
        try {
          await this.dataStore.rollbackWalletTransaction(debitedTransactionId);
        } catch (rollbackError) {
          console.error("critical_wallet_rollback_failure", {
            original_error: error.message,
            rollback_error: rollbackError.message,
            rider_id: riderId,
            policy_id: policyId,
            transaction_id: debitedTransactionId
          });
        }
      }
      throw error;
    }

    await this.notifyPolicyEvent({
      riderId,
      policy,
      notificationType
    });

    const response = {
      policy: this.formatPolicy(policy)
    };

    if (paymentMethod === "wallet") {
      response.wallet = walletResponse;
      response.transaction = transactionResponse;
    } else {
      response.payment = {
        method: "direct",
        status: "recorded"
      };
    }

    return response;
  }

  async renewPolicy({ riderId, sourcePolicyId, quoteId, paymentMethod }) {
    const sourcePolicy = await this.dataStore.getPolicyByIdForRider(sourcePolicyId, riderId);
    if (!sourcePolicy) {
      throw buildError({
        message: "Policy not found",
        code: "not_found",
        statusCode: 404
      });
    }

    const quote = await this.dataStore.getQuoteById(quoteId);
    if (!quote || quote.rider_id !== riderId) {
      throw buildError({
        message: "Quote not found",
        code: "not_found",
        statusCode: 404
      });
    }

    if (quote.week_start <= sourcePolicy.week_start) {
      throw buildError({
        message: "renewal quote must target a future coverage week",
        code: "validation_error",
        statusCode: 400
      });
    }

    return this.createPolicy({
      riderId,
      quoteId,
      paymentMethod,
      notificationType: "policy_renewed"
    });
  }

  async getCurrentPolicy(riderId) {
    const today = getCurrentISTDate(this.nowProvider());
    const policy = await this.dataStore.getCurrentPolicyByRiderId(riderId, today);
    return {
      current_policy: policy ? this.formatPolicy(policy) : null
    };
  }

  async listPolicyHistory(riderId, query) {
    const { limit, offset } = this.parsePagination(query);
    const [policies, total] = await Promise.all([
      this.dataStore.listPoliciesByRiderId(riderId, { limit, offset }),
      this.dataStore.countPoliciesByRiderId(riderId)
    ]);

    return {
      policies: policies.map((policy) => this.formatPolicy(policy)),
      pagination: {
        limit,
        offset,
        total,
        has_more: offset + policies.length < total
      }
    };
  }

  async getPolicyDetail(riderId, policyId) {
    const policy = await this.dataStore.getPolicyByIdForRider(policyId, riderId);
    if (!policy) {
      throw buildError({
        message: "Policy not found",
        code: "not_found",
        statusCode: 404
      });
    }

    return {
      policy: this.formatPolicy(policy)
    };
  }

  async runLifecycle() {
    const today = getCurrentISTDate(this.nowProvider());
    const result = await this.dataStore.runPolicyLifecycle(today);
    return {
      lifecycle_date: today,
      ...result
    };
  }
}

module.exports = {
  PolicyService
};
