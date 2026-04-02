const {
  getCurrentISTTimestamp,
  getNextMonday,
  getPurchaseDeadline,
  getWeekEnd,
  isBeforeDeadline,
  isMonday
} = require("../utils/time");
const { getUnderwritingState, isEligibleForPurchase } = require("../utils/underwriting");

class QuoteService {
  constructor({ dataStore, mlClient, weatherService, nowProvider = () => new Date() }) {
    this.dataStore = dataStore;
    this.mlClient = mlClient;
    this.weatherService = weatherService;
    this.nowProvider = nowProvider;
  }

  buildCoverageBreakdown(rider) {
    const lunchShifts = rider.shifts_covered === "lunch" ? 6 : rider.shifts_covered === "both" ? 6 : 0;
    const dinnerShifts = rider.shifts_covered === "dinner" ? 6 : rider.shifts_covered === "both" ? 6 : 0;
    return {
      lunch_shifts: lunchShifts,
      dinner_shifts: dinnerShifts,
      total_protected_shifts: lunchShifts + dinnerShifts,
      lunch_baseline_per_shift: rider.lunch_baseline,
      dinner_baseline_per_shift: rider.dinner_baseline,
      min_payout_pct: 20,
      max_payout_pct: 80
    };
  }

  getPurchaseBlockReason({ beforeDeadline, hasActiveDisruption, underwriting }) {
    if (hasActiveDisruption) {
      return "An active disruption event is detected in your zone. Policy purchase is temporarily unavailable.";
    }

    if (!beforeDeadline) {
      return "The purchase window for this policy week has closed.";
    }

    if (!isEligibleForPurchase(underwriting)) {
      return underwriting.message;
    }

    return null;
  }

  normalizeExplanation(explanation) {
    const safeExplanation = explanation && typeof explanation === "object" ? explanation : {};
    const topFactors = Array.isArray(safeExplanation.top_factors) ? safeExplanation.top_factors : [];
    const summary = typeof safeExplanation.summary === "string" ? safeExplanation.summary : "";

    return {
      top_factors: topFactors,
      summary
    };
  }

  async generateQuote({ riderId, weekStart }) {
    const now = this.nowProvider();

    if (!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
      const error = new Error("week_start must be provided in YYYY-MM-DD format");
      error.statusCode = 400;
      error.code = "validation_error";
      throw error;
    }

    if (!isMonday(weekStart)) {
      const error = new Error("week_start must be the next upcoming Monday in IST");
      error.statusCode = 400;
      error.code = "validation_error";
      throw error;
    }

    const expectedWeekStart = getNextMonday(now);
    if (weekStart !== expectedWeekStart) {
      const error = new Error("week_start must be the next upcoming Monday in IST");
      error.statusCode = 400;
      error.code = "validation_error";
      throw error;
    }

    const rider = await this.dataStore.getRiderById(riderId);
    if (!rider) {
      const error = new Error("Rider profile not found");
      error.statusCode = 404;
      error.code = "not_found";
      throw error;
    }

    const zone = await this.dataStore.getZoneById(rider.zone_id);
    if (!zone) {
      const error = new Error("Rider zone not found");
      error.statusCode = 404;
      error.code = "not_found";
      throw error;
    }

    const platformRider = await this.dataStore.getMockPlatformRiderByPhone(rider.phone);
    const underwriting = getUnderwritingState(platformRider);

    rider.lunch_baseline = rider.lunch_baseline || zone.avg_lunch_earnings;
    rider.dinner_baseline = rider.dinner_baseline || zone.avg_dinner_earnings;

    const recentTriggerSinceIso = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000).toISOString();
    const activeDisruptionSinceIso = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();

    const [recentTriggerCount, hasActiveDisruption, forecastOverride] = await Promise.all([
      this.dataStore.countRecentTriggers(zone.id, recentTriggerSinceIso),
      this.dataStore.hasActiveDisruption(zone.id, activeDisruptionSinceIso),
      this.weatherService.fetchWeeklyForecastSummary(zone)
    ]);

    const mlQuote = await this.mlClient.predictPremium({
      zone_id: zone.id,
      week_start: weekStart,
      shift_type: rider.shifts_covered,
      earnings_baseline_lunch: rider.lunch_baseline,
      earnings_baseline_dinner: rider.dinner_baseline,
      recent_trigger_count: recentTriggerCount,
      forecast_override: forecastOverride
    });
    const explanation = this.normalizeExplanation(mlQuote.explanation);

    const purchaseDeadline = getPurchaseDeadline(weekStart);
    const validUntil = purchaseDeadline;
    const weekEnd = getWeekEnd(weekStart);
    const beforeDeadline = isBeforeDeadline(purchaseDeadline, now);
    const canPurchase = beforeDeadline && !hasActiveDisruption && isEligibleForPurchase(underwriting);
    const purchaseBlockReason = this.getPurchaseBlockReason({
      beforeDeadline,
      hasActiveDisruption,
      underwriting
    });
    const coverageBreakdown = this.buildCoverageBreakdown(rider);

    const savedQuote = await this.dataStore.saveQuote({
      rider_id: rider.id,
      zone_id: zone.id,
      week_start: weekStart,
      shifts_covered: rider.shifts_covered,
      risk_score: mlQuote.risk_score,
      risk_band: mlQuote.risk_band,
      premium: mlQuote.premium,
      payout_cap: mlQuote.payout_cap,
      explanation,
      valid_until: validUntil
    });

    return {
      quote: {
        id: savedQuote.id,
        zone_id: zone.id,
        zone_name: zone.name,
        week_start: weekStart,
        week_end: weekEnd,
        shifts_covered: rider.shifts_covered,
        risk_score: mlQuote.risk_score,
        risk_band: mlQuote.risk_band,
        premium: mlQuote.premium,
        payout_cap: mlQuote.payout_cap,
        lunch_shift_max_payout: mlQuote.lunch_shift_max_payout,
        dinner_shift_max_payout: mlQuote.dinner_shift_max_payout,
        explanation,
        underwriting,
        coverage_breakdown: coverageBreakdown,
        can_purchase: canPurchase,
        ...(canPurchase ? {} : { reason: purchaseBlockReason }),
        purchase_deadline: purchaseDeadline,
        generated_at: getCurrentISTTimestamp()
      }
    };
  }
}

module.exports = {
  QuoteService
};
