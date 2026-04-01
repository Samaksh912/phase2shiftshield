const test = require("node:test");
const assert = require("node:assert/strict");
const { createTestDataStore } = require("./test-helpers");

test("storage returns normalized quote, policy, claim, and wallet alias shapes", async () => {
  const { dataStore } = createTestDataStore();

  const quote = await dataStore.saveQuote({
    rider_id: "11111111-1111-4111-8111-111111111111",
    zone_id: "koramangala",
    week_start: "2026-04-06",
    shifts_covered: "both",
    risk_score: 0.51,
    risk_band: "medium",
    premium: 55,
    payout_cap: 5280,
    explanation: {
      top_factors: [],
      summary: "normalized quote"
    },
    valid_until: "2026-04-05T23:59:00+05:30"
  });

  assert.equal(quote.explanation.summary, "normalized quote");
  assert.equal("explanation_json" in quote, false);

  const existingPolicy = await dataStore.getExistingPolicyForWeek(
    "11111111-1111-4111-8111-111111111111",
    "2026-03-30"
  );
  assert.equal(existingPolicy.id, "policy-asha-active");

  const policyHistory = await dataStore.listPolicyHistoryByRiderId(
    "11111111-1111-4111-8111-111111111111",
    { limit: 20, offset: 0 }
  );
  assert.equal(policyHistory.length, 1);
  assert.equal(policyHistory[0].id, "policy-asha-active");

  const activePolicies = await dataStore.listActivePoliciesByZoneAndShift(
    "koramangala",
    "lunch",
    "2026-03-31"
  );
  assert.equal(activePolicies.length, 1);
  assert.equal(activePolicies[0].rider.id, "11111111-1111-4111-8111-111111111111");
  assert.equal("riders" in activePolicies[0], false);

  const createdClaim = await dataStore.createClaim({
    rider_id: "11111111-1111-4111-8111-111111111111",
    policy_id: "policy-asha-active",
    trigger_event_id: "33333333-3333-4333-8333-333333333333",
    shift_type: "dinner",
    claim_date: "2026-03-31",
    baseline_used: 680,
    payout_percent: 42,
    payout_amount: 286,
    status: "paid",
    fraud_flag: false
  });

  assert.equal(createdClaim.policy, null);
  assert.equal(createdClaim.trigger_event, null);

  const claims = await dataStore.listClaimsByRiderId("11111111-1111-4111-8111-111111111111");
  assert.equal(claims.length, 1);
  assert.equal(claims[0].trigger_event.id, "33333333-3333-4333-8333-333333333333");
  assert.equal(claims[0].policy.id, "policy-asha-active");
  assert.equal("trigger_events" in claims[0], false);
  assert.equal("weekly_policies" in claims[0], false);

  const claimDetail = await dataStore.getClaimByIdForRider(
    claims[0].id,
    "11111111-1111-4111-8111-111111111111"
  );
  assert.equal(claimDetail.trigger_event.id, "33333333-3333-4333-8333-333333333333");
  assert.equal(claimDetail.policy.id, "policy-asha-active");

  const walletTransactions = await dataStore.listWalletTransactionsByRiderId(
    "11111111-1111-4111-8111-111111111111"
  );
  assert.equal(walletTransactions.length, 2);
  assert.equal(walletTransactions[0].wallet_id, "wallet-asha");
});
