function shiftMatches(policyShift, currentShift) {
  return policyShift === "both" || policyShift === currentShift;
}

function isPolicyActive(policy, claimDate) {
  return policy.status === "active" && policy.week_start <= claimDate && policy.week_end >= claimDate;
}

function hoursBetween(leftDate, rightDate) {
  return (leftDate.getTime() - rightDate.getTime()) / (1000 * 60 * 60);
}

function runFraudChecks({ rider, policy, triggerEvent, shiftType, claimDate, existingClaim, platformRider, now }) {
  const checks = {
    policy_active: isPolicyActive(policy, claimDate),
    shift_match: shiftMatches(policy.shifts_covered, shiftType),
    zone_match: rider.zone_id === triggerEvent.zone_id,
    duplicate_check: !existingClaim,
    recent_activity: false,
    platform_active: false
  };

  const lastAppActive = rider.last_app_active ? new Date(rider.last_app_active) : null;
  checks.recent_activity = lastAppActive ? hoursBetween(now, lastAppActive) <= 24 : false;

  const lastPlatformActive = platformRider?.last_active ? new Date(platformRider.last_active) : null;
  checks.platform_active = lastPlatformActive ? hoursBetween(now, lastPlatformActive) <= 48 : false;

  const hardFail = !checks.policy_active || !checks.shift_match || !checks.zone_match || !checks.duplicate_check;
  const softFail = !hardFail && (!checks.recent_activity || !checks.platform_active);

  return {
    hardFail,
    softFail,
    checks
  };
}

module.exports = {
  runFraudChecks
};
