const { getCurrentISTDate, getNextMonday, getPurchaseDeadline, isBeforeDeadline } = require("../utils/time");
const { resolveThresholdsForZone } = require("../utils/thresholds");

class DashboardService {
  constructor({ dataStore, weatherService, nowProvider = () => new Date() }) {
    this.dataStore = dataStore;
    this.weatherService = weatherService;
    this.nowProvider = nowProvider;
  }

  buildWeatherStatus(zone, { currentTemp, currentAqi, currentRainMm }) {
    const thresholds = resolveThresholdsForZone(zone);
    const breached =
      currentTemp >= thresholds.temp || currentAqi >= thresholds.aqi || currentRainMm >= thresholds.rain;
    if (breached) {
      return "threshold_breached";
    }

    const elevated =
      currentTemp >= thresholds.temp * 0.7 ||
      currentAqi >= thresholds.aqi * 0.7 ||
      currentRainMm >= thresholds.rain * 0.7;

    return elevated ? "elevated" : "normal";
  }

  buildShiftsRemaining(policy, claims) {
    if (!policy) {
      return null;
    }

    const totals = {
      lunch: policy.shifts_covered === "lunch" || policy.shifts_covered === "both" ? 6 : 0,
      dinner: policy.shifts_covered === "dinner" || policy.shifts_covered === "both" ? 6 : 0
    };

    const claimed = claims.reduce(
      (accumulator, claim) => {
        if (claim.shift_type === "lunch") {
          accumulator.lunch += 1;
        }
        if (claim.shift_type === "dinner") {
          accumulator.dinner += 1;
        }
        return accumulator;
      },
      { lunch: 0, dinner: 0 }
    );

    return {
      lunch: Math.max(0, totals.lunch - claimed.lunch),
      dinner: Math.max(0, totals.dinner - claimed.dinner)
    };
  }

  async getDashboard(riderId) {
    const now = this.nowProvider();
    const today = getCurrentISTDate(now);
    const [rider, wallet] = await Promise.all([
      this.dataStore.getRiderById(riderId),
      this.dataStore.getWalletByRiderId(riderId)
    ]);

    if (!rider) {
      const error = new Error("Rider profile not found");
      error.code = "not_found";
      error.statusCode = 404;
      throw error;
    }

    const zone = await this.dataStore.getZoneById(rider.zone_id);
    if (!zone) {
      const error = new Error("Rider zone not found");
      error.code = "not_found";
      error.statusCode = 404;
      throw error;
    }

    const [policy, claims, weather] = await Promise.all([
      this.dataStore.getCurrentPolicyByRiderId(riderId, today),
      this.dataStore.listClaimsByRiderId(riderId),
      this.weatherService.fetchWeeklyForecastSummary(zone)
    ]);

    const currentPolicyClaims = policy
      ? claims.filter((claim) => claim.policy_id === policy.id && claim.claim_date >= policy.week_start && claim.claim_date <= policy.week_end)
      : [];

    const currentTemp = weather.daily?.apparent_temperature_max?.[0] ?? weather.avg_max_temp ?? 0;
    const currentAqi = weather.daily?.daily_max_aqi?.[0] ?? weather.avg_max_aqi ?? 0;
    const currentRainMm = weather.daily?.precipitation_sum?.[0] ?? weather.avg_max_rain ?? 0;
    const nextWeekStart = getNextMonday(now);
    const nextWeekPolicy = await this.dataStore.getExistingPolicyForWeek(riderId, nextWeekStart);
    const nextWeekQuoteAvailable =
      !nextWeekPolicy && isBeforeDeadline(getPurchaseDeadline(nextWeekStart), now);

    return {
      rider: {
        name: rider.name,
        zone_name: zone.name,
        platform: rider.platform
      },
      wallet: {
        balance: wallet?.balance ?? 0
      },
      current_policy: policy
        ? {
            id: policy.id,
            week_start: policy.week_start,
            week_end: policy.week_end,
            status: policy.status,
            premium_paid: policy.premium_paid,
            shifts_covered: policy.shifts_covered,
            shifts_remaining: this.buildShiftsRemaining(policy, currentPolicyClaims),
            claims_this_week: currentPolicyClaims.length,
            total_payout_this_week: currentPolicyClaims
              .filter((claim) => claim.status === "paid")
              .reduce((sum, claim) => sum + claim.payout_amount, 0)
          }
        : null,
      zone_weather: {
        current_temp: currentTemp,
        current_aqi: currentAqi,
        current_rain_mm: currentRainMm,
        status: this.buildWeatherStatus(zone, { currentTemp, currentAqi, currentRainMm }),
        last_updated: now.toISOString()
      },
      recent_claims: claims.slice(0, 3).map((claim) => ({
        id: claim.id,
        shift_type: claim.shift_type,
        trigger_type: claim.trigger_event?.trigger_type || null,
        severity_level: claim.trigger_event?.severity_level || null,
        payout_percent: claim.payout_percent,
        payout_amount: claim.payout_amount,
        status: claim.status,
        created_at: claim.created_at
      })),
      next_week_quote_available: nextWeekQuoteAvailable
    };
  }
}

module.exports = {
  DashboardService
};
