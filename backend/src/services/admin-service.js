const { DISRUPTION_DURATION_MINUTES, getTriggerThreshold, resolveThresholdsForZone } = require("../utils/thresholds");

function mapTriggerToConditionA(triggerType, value, thresholds) {
  if (triggerType === "aqi") {
    return {
      aqi_value: value,
      threshold: getTriggerThreshold(triggerType, thresholds),
      duration_minutes: DISRUPTION_DURATION_MINUTES.aqi,
      value
    };
  }
  if (triggerType === "rain") {
    return {
      precipitation_mm: value,
      threshold: getTriggerThreshold(triggerType, thresholds),
      duration_minutes: DISRUPTION_DURATION_MINUTES.rain,
      value
    };
  }
  return {
    apparent_temp: value,
    threshold: getTriggerThreshold(triggerType, thresholds),
    duration_minutes: DISRUPTION_DURATION_MINUTES.heat,
    value
  };
}

function defaultConditionB() {
  return {
    traffic_drop: { confirmed: true, drop_pct: 47 },
    restaurant_drop: { confirmed: true, drop_pct: 38 },
    rider_count_drop: { confirmed: false, drop_pct: 22 }
  };
}

function mapSeverityToPayout(severityLevel) {
  if (severityLevel >= 4) {
    return 76;
  }
  if (severityLevel === 3) {
    return 63;
  }
  if (severityLevel === 2) {
    return 45;
  }
  return 28;
}

const VALID_TRIGGER_TYPES = new Set(["rain", "heat", "aqi"]);
const VALID_SHIFT_TYPES = new Set(["lunch", "dinner"]);

class AdminService {
  constructor({ dataStore, claimsEngine }) {
    this.dataStore = dataStore;
    this.claimsEngine = claimsEngine;
  }

  async simulateTrigger(payload) {
    const { zone_id: zoneId, trigger_type: triggerType, shift_type: shiftType } = payload;
    if (!zoneId || !triggerType || !shiftType) {
      const error = new Error("zone_id, trigger_type, and shift_type are required");
      error.statusCode = 400;
      error.code = "validation_error";
      throw error;
    }

    const zone = await this.dataStore.getZoneById(zoneId);
    if (!zone) {
      const error = new Error("zone_id must reference a known zone");
      error.statusCode = 400;
      error.code = "validation_error";
      throw error;
    }

    if (!VALID_TRIGGER_TYPES.has(triggerType)) {
      const error = new Error("trigger_type must be one of rain, heat, aqi");
      error.statusCode = 400;
      error.code = "validation_error";
      throw error;
    }

    if (!VALID_SHIFT_TYPES.has(shiftType)) {
      const error = new Error("shift_type must be one of lunch, dinner");
      error.statusCode = 400;
      error.code = "validation_error";
      throw error;
    }

    if (
      payload.payout_percent !== undefined &&
      (!Number.isInteger(payload.payout_percent) || payload.payout_percent < 20 || payload.payout_percent > 80)
    ) {
      const error = new Error("payout_percent must be an integer between 20 and 80");
      error.statusCode = 400;
      error.code = "validation_error";
      throw error;
    }

    const payoutPercent = payload.payout_percent ?? mapSeverityToPayout(payload.severity_level || 2);
    const severityLevel = payload.severity_level || (payoutPercent >= 56 ? 3 : payoutPercent >= 36 ? 2 : 1);
    const thresholds = resolveThresholdsForZone(zone);

    const triggerEvent = await this.dataStore.createTriggerEvent({
      zone_id: zoneId,
      trigger_type: triggerType,
      severity_level: severityLevel,
      payout_percent: payoutPercent,
      shift_type: shiftType,
      condition_a_data: {
        ...mapTriggerToConditionA(triggerType, payload.value, thresholds),
        zone_name: zone.name
      },
      condition_b_data: payload.condition_b || defaultConditionB()
    });

    const processed = await this.claimsEngine.processClaimsForTrigger(triggerEvent);

    return {
      trigger_event: triggerEvent,
      affected_policies_count: processed.affected_policies_count,
      claims_paid_count: processed.claims_paid_count,
      claims_under_review_count: processed.claims_under_review_count,
      total_wallet_credited: processed.total_wallet_credited
    };
  }
}

module.exports = {
  AdminService
};
