class ClaimsReadService {
  constructor({ dataStore }) {
    this.dataStore = dataStore;
  }

  async listClaimsForRider(riderId) {
    const claims = await this.dataStore.listClaimsByRiderId(riderId);
    const totalPremiumsPaid = await this.dataStore.sumPremiumsPaidForRider(riderId);
    const formattedClaims = claims.map((claim) => this.formatClaim(claim));
    const totalPayout = formattedClaims.reduce((sum, claim) => sum + claim.payout_amount, 0);

    return {
      claims: formattedClaims,
      summary: {
        total_claims: formattedClaims.length,
        total_payout: totalPayout,
        total_premiums_paid: totalPremiumsPaid,
        net_benefit: totalPayout - totalPremiumsPaid
      }
    };
  }

  async getClaimForRider(claimId, riderId) {
    const claim = await this.dataStore.getClaimByIdForRider(claimId, riderId);
    if (!claim) {
      const error = new Error("Claim not found");
      error.statusCode = 404;
      error.code = "not_found";
      throw error;
    }
    return {
      claim: this.formatClaim(claim)
    };
  }

  formatClaim(claim) {
    const triggerEvent = claim.trigger_event || {};
    const detail = this.getTriggerDetail(triggerEvent);
    return {
      id: claim.id,
      policy_id: claim.policy_id,
      shift_type: claim.shift_type,
      claim_date: claim.claim_date,
      trigger_type: triggerEvent.trigger_type,
      trigger_detail: detail,
      condition_b: triggerEvent.condition_b_data || {},
      severity_level: triggerEvent.severity_level,
      payout_percent: claim.payout_percent,
      baseline_used: claim.baseline_used,
      payout_amount: claim.payout_amount,
      status: claim.status,
      fraud_flag: claim.fraud_flag,
      created_at: claim.created_at
    };
  }

  getTriggerDetail(triggerEvent) {
    const conditionA = triggerEvent.condition_a_data || {};
    if (triggerEvent.trigger_type === "aqi") {
      return {
        aqi_value: conditionA.aqi_value || conditionA.max_aqi || conditionA.value,
        threshold: conditionA.threshold || 301,
        duration_minutes: conditionA.duration_minutes || 60,
        zone_name: conditionA.zone_name || triggerEvent.zone_id
      };
    }
    if (triggerEvent.trigger_type === "rain") {
      return {
        precipitation_mm: conditionA.precipitation_mm || conditionA.value,
        threshold: conditionA.threshold || 15,
        duration_minutes: conditionA.duration_minutes || 30,
        zone_name: conditionA.zone_name || triggerEvent.zone_id
      };
    }
      return {
        apparent_temp: conditionA.apparent_temp || conditionA.value,
        threshold: conditionA.threshold || 42,
        duration_minutes: conditionA.duration_minutes || 120,
        zone_name: conditionA.zone_name || triggerEvent.zone_id
      };
  }
}

module.exports = {
  ClaimsReadService
};
