const jwt = require("jsonwebtoken");
const { getConfig } = require("../src/utils/config");

function createAuthToken(riderId, phone) {
  return jwt.sign(
    {
      rider_id: riderId,
      phone
    },
    getConfig().jwtSecret,
    { expiresIn: "7d" }
  );
}

async function seedQuote(
  dataStore,
  { riderId, zoneId, weekStart, shiftsCovered, premium, payoutCap, validUntil, explanation }
) {
  return dataStore.saveQuote({
    rider_id: riderId,
    zone_id: zoneId,
    week_start: weekStart,
    shifts_covered: shiftsCovered,
    risk_score: 0.52,
    risk_band: "medium",
    premium,
    payout_cap: payoutCap,
    explanation: explanation || {
      top_factors: [],
      summary: "Seeded test quote"
    },
    valid_until: validUntil
  });
}

module.exports = {
  createAuthToken,
  seedQuote
};
