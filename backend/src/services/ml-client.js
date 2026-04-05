const { predictQuote } = require("./ml-inline");

// ─── Inline ML (active) ───────────────────────────────────────────────────────
// Uses ml-inline.js — a Node.js port of the Python/XGBoost service.
// No separate Render service needed; runs inside the backend process.
// To switch back to the external ML service, comment out this class and
// uncomment the HTTP-based MLClient below, then restore render.yaml.

class MLClient {
  async predictPremium(payload) {
    return predictQuote(payload);
  }
}

// ─── External HTTP ML client (kept for reference) ─────────────────────────────
// Previously called the separate shiftshield-ml Render service.
// Caused a second cold start on free tier (up to 60s total latency).
//
// const { getConfig } = require("../utils/config");
//
// class MLClient {
//   constructor(config = getConfig()) {
//     this.config = config;
//   }
//
//   async predictPremium(payload) {
//     const response = await fetch(`${this.config.mlServiceUrl}/premium/predict`, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify(payload),
//     });
//
//     if (!response.ok) {
//       const text = await response.text();
//       throw new Error(`ML service request failed (${response.status}): ${text}`);
//     }
//
//     return response.json();
//   }
// }

module.exports = { MLClient };
