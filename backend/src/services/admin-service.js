function mapTriggerToConditionA(triggerType, value) {
  if (triggerType === "aqi") {
    return { aqi_value: value, threshold: 301, duration_minutes: 135, value };
  }
  if (triggerType === "rain") {
    return { precipitation_mm: value, threshold: 15, duration_minutes: 45, value };
  }
  return { apparent_temp: value, threshold: 42, duration_minutes: 120, value };
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
    const payoutPercent = payload.payout_percent || mapSeverityToPayout(payload.severity_level || 2);
    const severityLevel = payload.severity_level || (payoutPercent >= 56 ? 3 : payoutPercent >= 36 ? 2 : 1);

    const triggerEvent = await this.dataStore.createTriggerEvent({
      zone_id: zoneId,
      trigger_type: triggerType,
      severity_level: severityLevel,
      payout_percent: payoutPercent,
      shift_type: shiftType,
      condition_a_data: {
        ...mapTriggerToConditionA(triggerType, payload.value),
        zone_name: zone?.name || zoneId
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
