const { getConfig } = require("../utils/config");

class MLClient {
  constructor(config = getConfig()) {
    this.config = config;
  }

  async predictPremium(payload) {
    const response = await fetch(`${this.config.mlServiceUrl}/premium/predict`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`ML service request failed (${response.status}): ${text}`);
    }

    return response.json();
  }
}

module.exports = {
  MLClient
};
