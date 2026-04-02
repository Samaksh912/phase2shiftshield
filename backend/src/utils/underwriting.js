function normalizeActiveDaysLast30(platformRider) {
  if (platformRider && Number.isSafeInteger(platformRider.active_days_last_30) && platformRider.active_days_last_30 >= 0) {
    return platformRider.active_days_last_30;
  }

  if (platformRider && Number.isSafeInteger(platformRider.active_days_per_week) && platformRider.active_days_per_week >= 0) {
    return Math.min(platformRider.active_days_per_week, 30);
  }

  return 0;
}

function getUnderwritingState(platformRider) {
  const activeDaysLast30 = normalizeActiveDaysLast30(platformRider);

  if (activeDaysLast30 >= 7) {
    return {
      status: "eligible",
      active_days_last_30: activeDaysLast30,
      message: "You are eligible to purchase or renew coverage."
    };
  }

  if (activeDaysLast30 >= 5) {
    return {
      status: "insufficient_history",
      active_days_last_30: activeDaysLast30,
      message: "At least 7 active delivery days in the last 30 days are required to purchase or renew coverage."
    };
  }

  return {
    status: "restricted",
    active_days_last_30: activeDaysLast30,
    message: "Coverage is restricted because you have fewer than 5 active delivery days in the last 30 days."
  };
}

function isEligibleForPurchase(underwriting) {
  return underwriting.status === "eligible";
}

module.exports = {
  getUnderwritingState,
  isEligibleForPurchase,
  normalizeActiveDaysLast30
};
