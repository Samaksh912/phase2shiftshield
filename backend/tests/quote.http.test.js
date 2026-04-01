const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const { buildApp } = require("../src/app");
const { getConfig } = require("../src/utils/config");
const { invokeApp } = require("./http-test-utils");

test("POST /api/quotes/generate returns blocked purchase reason through the Express app stack", async () => {
  const token = jwt.sign(
    {
      rider_id: "11111111-1111-4111-8111-111111111111",
      phone: "9876543210"
    },
    getConfig().jwtSecret,
    { expiresIn: "7d" }
  );

  const app = buildApp({
    quoteService: {
      async generateQuote() {
        return {
          quote: {
            id: "quote_blocked_1",
            zone_id: "koramangala",
            zone_name: "Koramangala",
            week_start: "2026-04-06",
            week_end: "2026-04-12",
            shifts_covered: "both",
            risk_score: 0.64,
            risk_band: "medium",
            premium: 59,
            payout_cap: 5280,
            lunch_shift_max_payout: 336,
            dinner_shift_max_payout: 544,
            explanation: {
              top_factors: [
                {
                  factor: "Historical triggers",
                  contribution_pct: 100,
                  detail: "1 triggers in the last 4 weeks"
                }
              ],
              summary: "Medium risk this week. 1 triggers in the last 4 weeks."
            },
            coverage_breakdown: {
              lunch_shifts: 6,
              dinner_shifts: 6,
              total_protected_shifts: 12,
              lunch_baseline_per_shift: 420,
              dinner_baseline_per_shift: 680,
              min_payout_pct: 20,
              max_payout_pct: 80
            },
            can_purchase: false,
            reason: "An active disruption event is detected in your zone. Policy purchase is temporarily unavailable.",
            purchase_deadline: "2026-04-05T23:59:00+05:30",
            generated_at: "2026-04-01T06:16:05+05:30"
          }
        };
      }
    }
  });

  const response = await invokeApp(app, {
    method: "POST",
    url: "/api/quotes/generate",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: {
      week_start: "2026-04-06"
    }
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.quote.can_purchase, false);
  assert.equal(
    response.body.quote.reason,
    "An active disruption event is detected in your zone. Policy purchase is temporarily unavailable."
  );
});
